package com.pingo.backend.transcription.dto;

/**
 * 받아쓴 결과.
 *
 * 알아듣지 못했어도 오류로 돌려주지 않는다. 사람이 말하지 않은 조각(숨소리, 지나가는 소음)은
 * 흔하고, 그때마다 화면에 실패를 띄우면 상담자는 고장난 줄 안다. 빈 글이면 그 조각은 그냥
 * 버리면 된다.
 */
public record TranscriptionResponse(String text) {

    public static TranscriptionResponse empty() {
        return new TranscriptionResponse("");
    }

    public static TranscriptionResponse of(String text) {
        return new TranscriptionResponse(text);
    }
}
