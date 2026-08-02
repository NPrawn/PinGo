package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationTranscript;
import com.pingo.backend.consultation.domain.TranscriptSpeaker;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class LlmConsultationSummaryGenerator implements ConsultationSummaryGenerator{

    private static final int MAX_SUMMARY_LENGTH = 500;

    private static final String SYSTEM_PROMPT = """
            너는 지하철역 실내 안내 상담 기록을 요약하는 도우미다.
            아래 상담 대화록을 읽고, 상담자가 무엇을 어떻게 안내했는지 한 문장으로 요약하라.

            규칙:
            - 한국어 한 문장, 100자 이내로 작성한다.
            - "~완료", "~안내" 처럼 명사형 종결로 끝낸다.
            - 대화에 없는 사실을 지어내지 않는다.
            - 출구 번호, 층, 랜드마크 같은 구체적 단서가 있으면 포함한다.
            - 요약 문장만 출력하고 다른 말을 덧붙이지 않는다.
            """;

    private final RestClient restClient;
    private final String generatePath;

    public LlmConsultationSummaryGenerator(
            @Value("${summary.api.base-url}") String baseUrl,
            @Value("${summary.api.key}") String apiKey,
            @Value("${summary.api.model}") String model){

        this.generatePath = "/models/" + model + ":generateContent";

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(20));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("x-goog-api-key", apiKey)
                .build();
    }

    @Override
    public String generate(List<ConsultationTranscript> transcripts) {
        String dialogue = transcripts.stream()
                .map(t -> speakerLabel(t.getSpeaker()) + ": " + t.getContent())
                .collect(Collectors.joining("\n"));

        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of(
                        "parts", List.of(Map.of("text", SYSTEM_PROMPT))
                ),
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", dialogue)))
                ),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "maxOutputTokens", 300,
                        "thinkingConfig", Map.of("thinkingBudget", 0)
                )
        );

        GeminiResponse response = restClient.post()
                .uri(generatePath)
                .body(body)
                .retrieve()
                .body(GeminiResponse.class);

        String text = extractText(response);
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("요약 생성 응답이 비어 있습니다.");
        }

        String summary = text.trim();
        return summary.length() > MAX_SUMMARY_LENGTH
                ? summary.substring(0, MAX_SUMMARY_LENGTH)
                : summary;
    }

    private String extractText(GeminiResponse response) {
        if (response == null || response.candidates() == null || response.candidates().isEmpty()) {
            return null;
        }
        GeminiResponse.Content content = response.candidates().get(0).content();
        if (content == null || content.parts() == null || content.parts().isEmpty()) {
            return null;
        }
        return content.parts().get(0).text();
    }

    private String speakerLabel(TranscriptSpeaker speaker) {
        return speaker == TranscriptSpeaker.USER ? "사용자" : "상담원";
    }

    private record GeminiResponse(List<Candidate> candidates) {

        private record Candidate(Content content, String finishReason) {
        }

        private record Content(List<Part> parts, String role) {
        }

        private record Part(String text) {
        }
    }
}
