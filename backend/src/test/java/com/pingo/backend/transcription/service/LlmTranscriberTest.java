package com.pingo.backend.transcription.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 말소리가 없다는 표시를 걸러 내는 부분만 본다. 모델 호출은 여기서 다루지 않는다.
 *
 * 이 걸러 내기가 없으면 조용한 조각마다 **모델이 지어낸 설명문이 사용자 발화로 전문에 박힌다.**
 * "아무것도 출력하지 마라"고 시켜도 모델은 침묵하는 대신 `이 오디오는 00:00부터 00:02까지
 * 아무런 소리가 없습니다` 같은 문장을 내놓는다.
 */
class LlmTranscriberTest {

    @Test
    void dropsTheNoSpeechMarker() {
        assertThat(LlmTranscriber.withoutNoSpeechMarker("<no-speech>")).isNull();
        assertThat(LlmTranscriber.withoutNoSpeechMarker("  <no-speech>  ")).isNull();
        assertThat(LlmTranscriber.withoutNoSpeechMarker("<NO-SPEECH>")).isNull();
    }

    @Test
    void keepsRealSpeech() {
        assertThat(LlmTranscriber.withoutNoSpeechMarker("3번 출구로 가려면요?"))
                .isEqualTo("3번 출구로 가려면요?");
    }

    /**
     * 여러 마디가 담긴 조각의 끝에 표시가 한 줄로 따라붙는 경우가 있다. 그때 통째로 버리면
     * 앞의 멀쩡한 발화까지 사라진다.
     */
    @Test
    void keepsSpeechThatCameWithATrailingMarker() {
        assertThat(LlmTranscriber.withoutNoSpeechMarker("3번 출구요\n<no-speech>"))
                .isEqualTo("3번 출구요");
    }

    @Test
    void treatsBlankAsNothing() {
        assertThat(LlmTranscriber.withoutNoSpeechMarker("   ")).isNull();
        assertThat(LlmTranscriber.withoutNoSpeechMarker(null)).isNull();
    }
}
