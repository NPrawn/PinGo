package com.pingo.backend.transcription.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

/** GMS의 OpenAI 호환 음성 전사 API에 발화 파일을 보내 받아쓴다. */
@Slf4j
@Component
public class WhisperTranscriber implements Transcriber {

    private static final String NO_SPEECH_MARKER = "<no-speech>";
    private static final int RUNAWAY_REPEAT_COUNT = 8;
    private static final int MAX_ERROR_BODY_LOG_LENGTH = 1_000;
    private static final Pattern WORD_SEPARATOR = Pattern.compile("[^\\p{L}\\p{N}']+");
    private static final Set<String> SUPPORTED_MIME_TYPES = Set.of(
            "audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/mpeg", "audio/aac", "audio/flac"
    );

    private final RestClient restClient;
    private final String model;

    public WhisperTranscriber(
            @Value("${transcription.api.base-url}") String baseUrl,
            @Value("${transcription.api.key}") String apiKey,
            @Value("${transcription.api.model:whisper-1}") String model,
            @Value("${transcription.api.read-timeout-ms:15000}") long readTimeoutMs
    ) {
        this.model = model;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                // Spring 7은 기본적으로 요청 본문을 스트리밍한다. multipart 전체 길이를 모르면
                // chunked로 전송하는데, GMS 앞단 Cloudflare가 이 요청을 400으로 거절한다.
                // 오디오는 서비스에서 1MB로 제한하므로 메모리에 완성해 Content-Length를 붙인다.
                .bufferContent((uri, method) -> true)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
    }

    @Override
    public String transcribe(MultipartFile audio, String language) {
        String mimeType = baseMimeTypeOf(audio.getContentType());
        if (!SUPPORTED_MIME_TYPES.contains(mimeType)) {
            log.warn("Unsupported transcription audio mime type. mimeType={}", audio.getContentType());
            return null;
        }

        LinkedMultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", audioPart(audio, mimeType));
        body.add("model", model);
        body.add("response_format", "json");
        body.add("temperature", "0");

        String normalizedLanguage = normalizeLanguage(language);
        if (normalizedLanguage != null) {
            body.add("language", normalizedLanguage);
        }

        try {
            WhisperResponse response = restClient.post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(WhisperResponse.class);

            return sanitizeTranscription(response == null ? null : response.text());
        } catch (RestClientResponseException exception) {
            log.warn(
                    "Whisper API returned an error. status={}, mimeType={}, audioBytes={}, responseBody={}",
                    exception.getStatusCode().value(),
                    mimeType,
                    audio.getSize(),
                    summarizeErrorBody(exception.getResponseBodyAsString())
            );
            throw new BusinessException(ErrorCode.TRANSCRIPTION_SERVICE_FAILED);
        } catch (RuntimeException exception) {
            log.warn("Failed to transcribe audio with Whisper. mimeType={}, audioBytes={}",
                    mimeType,
                    audio.getSize(),
                    exception);
            // 외부 API 장애를 무음과 같은 빈 200으로 숨기면 클라이언트가 재시도하거나 경고할 수 없다.
            throw new BusinessException(ErrorCode.TRANSCRIPTION_SERVICE_FAILED);
        }
    }

    private HttpEntity<Resource> audioPart(MultipartFile audio, String mimeType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(mimeType));
        return new HttpEntity<>(audio.getResource(), headers);
    }

    private String baseMimeTypeOf(String mimeType) {
        if (mimeType == null) {
            return MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        int separator = mimeType.indexOf(';');
        return (separator < 0 ? mimeType : mimeType.substring(0, separator))
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    /** 외부 응답의 줄바꿈과 과도한 HTML을 정리해 운영 로그 한 건이 지나치게 커지지 않게 한다. */
    static String summarizeErrorBody(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "<empty>";
        }
        String singleLine = responseBody.replaceAll("\\s+", " ").trim();
        if (singleLine.length() <= MAX_ERROR_BODY_LOG_LENGTH) {
            return singleLine;
        }
        return singleLine.substring(0, MAX_ERROR_BODY_LOG_LENGTH) + "...";
    }

    /** 화면 언어가 아니라 실제 발화 언어일 때만 ISO-639-1 두 글자를 전달한다. */
    static String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) {
            return null;
        }
        String base = language.trim().toLowerCase(Locale.ROOT).split("[-_]", 2)[0];
        return base.matches("[a-z]{2}") ? base : null;
    }

    /** 무음 표시, 중복 줄, 잡음에서 생기는 단어 반복 폭주를 최종 전문에 넣지 않는다. */
    static String sanitizeTranscription(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        List<String> kept = new ArrayList<>();
        String previous = null;
        for (String rawLine : text.lines().toList()) {
            String line = rawLine.trim();
            if (line.isEmpty() || line.equalsIgnoreCase(NO_SPEECH_MARKER)) {
                continue;
            }
            if (hasRunawayWordRepetition(line)) {
                // 한 줄의 반복 폭주 때문에 같은 응답에 담긴 다른 정상 문장까지 버리지 않는다.
                continue;
            }
            if (!line.equals(previous)) {
                kept.add(line);
                previous = line;
            }
        }

        return kept.isEmpty() ? null : String.join("\n", kept);
    }

    private static boolean hasRunawayWordRepetition(String text) {
        String[] words = WORD_SEPARATOR.split(text.toLowerCase(Locale.ROOT));
        String previous = null;
        int repeats = 0;
        for (String word : words) {
            if (word.isBlank()) {
                continue;
            }
            if (word.equals(previous)) {
                repeats += 1;
            } else {
                previous = word;
                repeats = 1;
            }
            if (repeats >= RUNAWAY_REPEAT_COUNT) {
                return true;
            }
        }
        return false;
    }

    private record WhisperResponse(String text) {
    }
}
