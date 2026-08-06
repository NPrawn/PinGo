package com.pingo.backend.transcription.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 발화 한 토막을 받아써 달라는 요청.
 *
 * 브라우저가 자기 마이크 스트림을 그대로 녹음해 보낸다. 브라우저의 음성 인식을 쓰지 않는
 * 이유는 그것이 `getUserMedia` 와 **마이크를 다투기** 때문이다. 안드로이드에서는 통화 캡처가
 * 이기고 인식기가 `audio-capture` 로 죽는데, 목소리는 멀쩡히 오가니 아무도 눈치채지 못한 채
 * 그쪽 발화만 전문에서 통째로 빠진다. `MediaRecorder` 는 이미 열린 트랙을 인코딩할 뿐이라
 * 마이크를 새로 열지 않아 이 다툼이 없다.
 */
public record TranscriptionRequest(

        /**
         * base64 로 담은 오디오.
         *
         * 길이를 제한하는 것은 비용 때문만이 아니다. GMS 프록시는 요청 본문이 약 100KB 를
         * 넘으면 **본문을 빈 것으로 만들어 넘긴다.** 그러면 모델은 `contents is not specified`
         * 라는 엉뚱한 400 을 돌려주어, 크기 문제라는 사실이 전혀 드러나지 않는다. 여기서
         * 미리 걸러 그 혼란을 만들지 않는다.
         *
         * 80,000 자는 opus 16kbps 기준 약 30초다. 화면은 15초에서 끊으므로 두 배의 여유가 있다.
         */
        @NotBlank
        @Size(max = 80_000)
        String audio,

        /** `audio/webm` 처럼 담긴 형식. 브라우저 `MediaRecorder` 가 알려 준 값을 그대로 보낸다. */
        @NotBlank
        @Size(max = 64)
        String mimeType,

        /** 말하는 사람의 언어(`ko`, `en` …). 비워 두면 모델이 알아서 가려낸다. */
        @Size(max = 16)
        String language
) {
}
