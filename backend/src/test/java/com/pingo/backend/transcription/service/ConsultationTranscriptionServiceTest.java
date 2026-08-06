package com.pingo.backend.transcription.service;

import com.pingo.backend.transcription.dto.TranscriptionResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;

class ConsultationTranscriptionServiceTest {

    private static MockMultipartFile audio() {
        return new MockMultipartFile(
                "file",
                "segment.webm",
                "audio/webm;codecs=opus",
                "audio-data".getBytes()
        );
    }

    @Test
    void returnsTranscribedText() {
        ConsultationTranscriptionService service =
                new ConsultationTranscriptionService((audio, language) -> "3번 출구로 가려면요?");

        TranscriptionResponse response = service.transcribe("cs_1", audio(), "ko");

        assertThat(response.text()).isEqualTo("3번 출구로 가려면요?");
    }

    /**
     * 알아듣지 못한 조각은 오류가 아니라 빈 글이다.
     *
     * 숨소리나 지나가는 소음만 담긴 조각은 흔하다. 그때마다 실패로 돌려주면 화면은 몇 번을
     * 다시 보내도 결과가 같은 조각을 붙들고 헛된 왕복만 늘린다. 그동안 다음 발화가 밀린다.
     */
    @Test
    void returnsEmptyTextWhenNothingWasRecognized() {
        ConsultationTranscriptionService service =
                new ConsultationTranscriptionService((audio, language) -> null);

        TranscriptionResponse response = service.transcribe("cs_1", audio(), "ko");

        assertThat(response.text()).isEmpty();
    }

    /** 화면이 알려 준 형식과 언어를 그대로 넘겨야 모델이 엉뚱한 언어로 받아쓰지 않는다. */
    @Test
    void passesMimeTypeAndLanguageThrough() {
        String[] seen = new String[2];
        ConsultationTranscriptionService service =
                new ConsultationTranscriptionService((audio, language) -> {
                    seen[0] = audio.getContentType();
                    seen[1] = language;
                    return "ok";
                });

        service.transcribe("cs_1", audio(), "ko");

        assertThat(seen[0]).isEqualTo("audio/webm;codecs=opus");
        assertThat(seen[1]).isEqualTo("ko");
    }
}
