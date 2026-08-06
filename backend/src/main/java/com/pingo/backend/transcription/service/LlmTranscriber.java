package com.pingo.backend.transcription.service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 발화 토막을 모델에 맡겨 받아쓴다.
 *
 * 번역·요약과 같은 모델을 쓰되 제한 시간은 따로 잡는다. 오디오는 글보다 무거워 왕복이 3초쯤
 * 걸리는데, 번역에 맞춰 둔 6초로는 조금만 길어져도 끊긴다.
 */
@Slf4j
@Component
public class LlmTranscriber implements Transcriber {

    /**
     * 말소리가 없을 때 모델이 대신 내놓는 표시.
     *
     * **"아무것도 출력하지 마라"로는 부족하다.** 그렇게 시켜 두고 조용한 조각을 보내면 모델은
     * 침묵하는 대신 `이 오디오는 00:00부터 00:02까지 아무런 소리가 없습니다` 같은 **설명문을
     * 지어낸다.** 그 문장은 받아쓴 글과 구분되지 않아 그대로 전문에 사용자 발화로 박힌다.
     *
     * 그래서 없다는 사실도 정해진 말로 내놓게 하고, 여기서 걸러 낸다. 무엇이 올지 알면 지울 수
     * 있지만, 무엇이 올지 모르면 지울 수 없다.
     */
    private static final String NO_SPEECH_MARKER = "<no-speech>";

    /**
     * 짧게 쓴다. **프롬프트가 오디오보다 비쌀 수 있기 때문이다.**
     *
     * 모델은 오디오를 초당 32 토큰으로 센다. 3초짜리 조각이 96 토큰이니, 지시문이 길면 정작
     * 받아쓸 소리보다 비싸진다. 이 글은 82 토큰이다.
     */
    private static final String SYSTEM_PROMPT = """
            들리는 그대로 받아쓴다. 받아쓴 글만 출력하고 설명이나 따옴표를 붙이지 않는다. \
            사람의 말소리가 없거나 알아들을 수 없으면 다른 말 없이 정확히 <no-speech> 라고만 \
            출력한다. 없는 말을 지어내거나 끊긴 말을 채워 넣지 않는다.
            """;

    /**
     * 모델이 받아 주는 형식만 통과시킨다.
     *
     * 브라우저마다 `MediaRecorder` 가 내놓는 형식이 다르다. 모르는 형식을 그대로 넘기면 모델이
     * 400 을 돌려주는데, 그 오류는 화면까지 올라오지 않고 조각만 조용히 사라진다.
     */
    private static final List<String> SUPPORTED_MIME_TYPES =
            List.of("audio/webm", "audio/ogg", "audio/wav", "audio/mp4", "audio/mpeg", "audio/aac", "audio/flac");

    private final RestClient restClient;
    private final String generatePath;

    public LlmTranscriber(
            @Value("${summary.api.base-url}") String baseUrl,
            @Value("${summary.api.key}") String apiKey,
            @Value("${transcription.api.model:${summary.api.model}}") String model,
            @Value("${transcription.api.read-timeout-ms:15000}") long readTimeoutMs
    ) {
        this.generatePath = "/models/" + model + ":generateContent";

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofMillis(readTimeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("x-goog-api-key", apiKey)
                .build();
    }

    /**
     * 받아쓰지 못하면 null 을 돌려준다.
     *
     * 조각 하나가 실패했다고 상담을 끊을 수는 없다. 부른 쪽이 그 조각만 버린다.
     */
    @Override
    public String transcribe(String audioBase64, String mimeType, String language) {
        String normalizedMimeType = baseMimeTypeOf(mimeType);
        if (!SUPPORTED_MIME_TYPES.contains(normalizedMimeType)) {
            log.warn("Unsupported audio mime type. mimeType={}", mimeType);
            return null;
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("text", instructionFor(language)));
        parts.add(Map.of("inlineData", Map.of(
                "mimeType", normalizedMimeType,
                "data", audioBase64
        )));

        // 순서를 지켜야 읽기 쉬운 본문이 된다. `Map.of` 는 순서를 보장하지 않는다.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        body.put("contents", List.of(Map.of("parts", parts)));
        body.put("generationConfig", Map.of(
                // 같은 소리는 늘 같게 받아써야 전문을 다시 읽는 사람이 헷갈리지 않는다.
                "temperature", 0.0,
                "maxOutputTokens", 1024,
                "thinkingConfig", Map.of("thinkingBudget", 0)
        ));

        try {
            GeminiResponse response = restClient.post()
                    .uri(generatePath)
                    .body(body)
                    .retrieve()
                    .body(GeminiResponse.class);

            return withoutNoSpeechMarker(firstText(response));
        } catch (RuntimeException exception) {
            log.warn("Failed to transcribe audio. mimeType={}, base64Length={}",
                    normalizedMimeType,
                    audioBase64.length(),
                    exception);
            return null;
        }
    }

    /**
     * 말소리가 없다는 표시를 걷어 낸다. 남는 것이 없으면 null 이다.
     *
     * 줄 단위로 지우는 이유는, 여러 마디가 담긴 조각의 끝에 이 표시가 한 줄로 따라붙는 경우가
     * 있기 때문이다. 그때 앞의 멀쩡한 말까지 버리면 실제 발화가 사라진다.
     */
    static String withoutNoSpeechMarker(String text) {
        if (text == null) {
            return null;
        }

        String kept = text.lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty())
                .filter(line -> !line.equalsIgnoreCase(NO_SPEECH_MARKER))
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");

        return kept.isBlank() ? null : kept;
    }

    /** 언어를 알면 알려 준다. 모르면 굳이 지어 내지 않고 모델이 가려내게 둔다. */
    private String instructionFor(String language) {
        if (language == null || language.isBlank()) {
            return "이 오디오를 받아써라.";
        }
        return "이 오디오를 받아써라. 말하는 언어는 " + language.trim() + " 이다.";
    }

    /** `audio/webm;codecs=opus` 처럼 매개변수가 붙어 온다. 형식만 본다. */
    private String baseMimeTypeOf(String mimeType) {
        int separator = mimeType.indexOf(';');
        return (separator < 0 ? mimeType : mimeType.substring(0, separator))
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private String firstText(GeminiResponse response) {
        if (response == null || response.candidates() == null || response.candidates().isEmpty()) {
            return null;
        }

        GeminiResponse.Candidate candidate = response.candidates().get(0);
        if (candidate.content() == null || candidate.content().parts() == null) {
            return null;
        }

        return candidate.content().parts().stream()
                .map(GeminiResponse.Part::text)
                .filter(part -> part != null && !part.isBlank())
                .findFirst()
                .orElse(null);
    }

    private record GeminiResponse(List<Candidate> candidates) {

        private record Candidate(Content content) {
        }

        private record Content(List<Part> parts) {
        }

        private record Part(String text) {
        }
    }
}
