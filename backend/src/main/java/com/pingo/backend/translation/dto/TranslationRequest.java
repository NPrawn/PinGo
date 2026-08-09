package com.pingo.backend.translation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 실시간 자막 한 줄을 옮겨 달라는 요청.
 *
 * 자막은 말이 끝날 때마다 한 줄씩 온다. 길이를 제한해 두는 이유는, 잘못된 호출 하나가
 * 모델 호출 비용을 통째로 끌어올리지 못하게 하기 위해서다.
 */
public record TranslationRequest(
        @NotBlank
        @Size(max = 1000)
        String text,

        /** BCP-47 언어 코드(`ko`, `en`, `ja`, `zh`). 화면이 고른 표시 언어다. */
        @NotBlank
        @Size(max = 16)
        String targetLanguage
) {
}
