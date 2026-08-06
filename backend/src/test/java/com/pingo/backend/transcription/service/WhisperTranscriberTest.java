package com.pingo.backend.transcription.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhisperTranscriberTest {

    @Test
    void dropsTheNoSpeechMarker() {
        assertThat(WhisperTranscriber.sanitizeTranscription("<no-speech>")).isNull();
        assertThat(WhisperTranscriber.sanitizeTranscription("  <NO-SPEECH>  ")).isNull();
    }

    @Test
    void keepsRealSpeech() {
        assertThat(WhisperTranscriber.sanitizeTranscription("3번 출구로 가려면요?"))
                .isEqualTo("3번 출구로 가려면요?");
    }

    @Test
    void treatsBlankAsNothing() {
        assertThat(WhisperTranscriber.sanitizeTranscription("   ")).isNull();
        assertThat(WhisperTranscriber.sanitizeTranscription(null)).isNull();
    }

    @Test
    void dropsRunawayWordRepetition() {
        assertThat(WhisperTranscriber.sanitizeTranscription("I got a gun, ah ah ah ah ah ah ah"))
                .isNull();
    }

    @Test
    void collapsesRepeatedLines() {
        assertThat(WhisperTranscriber.sanitizeTranscription("3번 출구요\n3번 출구요\n3번 출구요"))
                .isEqualTo("3번 출구요");
    }

    @Test
    void keepsShortNaturalRepetition() {
        assertThat(WhisperTranscriber.sanitizeTranscription("네 네 알겠습니다"))
                .isEqualTo("네 네 알겠습니다");
    }

    @Test
    void normalizesBrowserLanguageTags() {
        assertThat(WhisperTranscriber.normalizeLanguage("ko-KR")).isEqualTo("ko");
        assertThat(WhisperTranscriber.normalizeLanguage("en_US")).isEqualTo("en");
        assertThat(WhisperTranscriber.normalizeLanguage("auto")).isNull();
    }
}
