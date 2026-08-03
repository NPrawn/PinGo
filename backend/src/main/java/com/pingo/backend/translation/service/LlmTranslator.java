package com.pingo.backend.translation.service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * 상담 자막을 상대 언어로 옮긴다.
 *
 * 요약과 같은 모델을 쓰되 설정은 따로 잡는다. 자막은 말이 끝날 때마다 한 줄씩 들어오므로
 * 요약보다 훨씬 자주, 훨씬 짧게 부른다. 오래 기다리면 이미 다음 말이 지나가 버려 늦은 번역은
 * 쓸모가 없다 — 그래서 읽기 제한 시간을 짧게 둔다.
 */
@Slf4j
@Component
public class LlmTranslator implements Translator {

    private static final String SYSTEM_PROMPT = """
            너는 지하철역 실내 안내 상담의 실시간 자막을 옮기는 번역기다.

            규칙:
            - 입력 문장을 요청된 언어로 옮긴 결과만 출력한다.
            - 설명, 따옴표, 원문 병기, 머리말을 붙이지 않는다.
            - 이미 요청된 언어면 그대로 출력한다.
            - 출구 번호, 층, 역 이름 같은 고유 표기는 숫자와 뜻을 바꾸지 않는다.
            - 말이 중간에 끊겨 있어도 있는 그대로 옮기고 문장을 지어내 채우지 않는다.
            """;

    private final RestClient restClient;
    private final String generatePath;

    public LlmTranslator(
            @Value("${summary.api.base-url}") String baseUrl,
            @Value("${summary.api.key}") String apiKey,
            @Value("${translation.api.model:${summary.api.model}}") String model,
            @Value("${translation.api.read-timeout-ms:6000}") long readTimeoutMs
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
     * 옮기지 못하면 null 을 돌려준다.
     *
     * 번역 하나가 실패했다고 상담을 끊을 수는 없다. 호출한 쪽이 원문을 그대로 띄운다.
     */
    @Override
    public String translate(String text, String targetLanguage) {
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of(
                        "parts", List.of(Map.of("text", SYSTEM_PROMPT))
                ),
                "contents", List.of(
                        Map.of("parts", List.of(Map.of(
                                "text", "다음 문장을 " + targetLanguage + " 로 옮겨라.\n\n" + text
                        )))
                ),
                "generationConfig", Map.of(
                        // 자막은 매번 같은 문장이 같게 나와야 읽는 사람이 헷갈리지 않는다.
                        "temperature", 0.0,
                        "maxOutputTokens", 512,
                        "thinkingConfig", Map.of("thinkingBudget", 0)
                )
        );

        try {
            GeminiResponse response = restClient.post()
                    .uri(generatePath)
                    .body(body)
                    .retrieve()
                    .body(GeminiResponse.class);

            String translated = firstText(response);
            return translated == null || translated.isBlank() ? null : translated.trim();
        } catch (RuntimeException exception) {
            log.warn("Failed to translate caption. targetLanguage={}", targetLanguage, exception);
            return null;
        }
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
