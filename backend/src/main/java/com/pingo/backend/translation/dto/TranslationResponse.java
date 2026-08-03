package com.pingo.backend.translation.dto;

/**
 * 옮긴 결과.
 *
 * `translated` 가 false 면 원문을 그대로 돌려준 것이다. 옮길 필요가 없었거나(같은 언어)
 * 모델에 닿지 못한 경우인데, 화면은 어느 쪽이든 원문이라도 띄울 수 있어야 한다.
 */
public record TranslationResponse(
        String text,
        String targetLanguage,
        boolean translated
) {

    public static TranslationResponse untouched(String text, String targetLanguage) {
        return new TranslationResponse(text, targetLanguage, false);
    }

    public static TranslationResponse of(String text, String targetLanguage) {
        return new TranslationResponse(text, targetLanguage, true);
    }
}
