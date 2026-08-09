package com.pingo.backend.translation.service;

import com.pingo.backend.translation.dto.TranslationRequest;
import com.pingo.backend.translation.dto.TranslationResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ConsultationTranslationServiceTest {

    @Test
    void translatesCaptionIntoRequestedLanguage() {
        ConsultationTranslationService service =
                new ConsultationTranslationService((text, language) -> "Exit 3 is on the left");

        TranslationResponse response = service.translate(
                new TranslationRequest("3번 출구는 왼쪽입니다", "en"));

        assertThat(response.text()).isEqualTo("Exit 3 is on the left");
        assertThat(response.translated()).isTrue();
    }

    /**
     * 번역 하나가 실패했다고 자막까지 사라지면 안 된다.
     *
     * 상담 중에 화면이 비면 사용자는 상대가 무슨 말을 했는지조차 알 수 없다. 옮기지 못한
     * 원문이라도 띄우는 편이 낫다.
     */
    @Test
    void keepsOriginalTextWhenTranslationFails() {
        ConsultationTranslationService service =
                new ConsultationTranslationService((text, language) -> null);

        TranslationResponse response = service.translate(
                new TranslationRequest("3번 출구는 왼쪽입니다", "en"));

        assertThat(response.text()).isEqualTo("3번 출구는 왼쪽입니다");
        assertThat(response.translated()).isFalse();
    }

    /**
     * 브라우저는 `ko-KR` 처럼 지역까지 붙여 준다. 그대로 받으면 지원 언어와 맞지 않아
     * 옮길 수 있는 문장도 원문으로 되돌아간다.
     */
    @ParameterizedTest
    @ValueSource(strings = {"en-US", "EN", " en ", "en"})
    void readsLanguageWithoutRegion(String requested) {
        ConsultationTranslationService service =
                new ConsultationTranslationService((text, language) -> "translated:" + language);

        TranslationResponse response = service.translate(
                new TranslationRequest("안녕하세요", requested));

        assertThat(response.translated()).isTrue();
        assertThat(response.text()).isEqualTo("translated:en");
    }

    /** 지원하지 않는 언어는 오류가 아니라 원문으로 돌려준다. 자막은 계속 보여야 한다. */
    @Test
    void leavesUnsupportedLanguageUntouched() {
        ConsultationTranslationService service =
                new ConsultationTranslationService((text, language) -> "should not be called");

        TranslationResponse response = service.translate(
                new TranslationRequest("안녕하세요", "fr"));

        assertThat(response.text()).isEqualTo("안녕하세요");
        assertThat(response.translated()).isFalse();
    }
}
