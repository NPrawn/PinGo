package com.pingo.backend.signaling.dto;

public enum SignalingMessageType {
    JOIN,
    LEAVE,
    OFFER,
    ANSWER,
    ICE_CANDIDATE,
    CAPTION,
    /**
     * 연결을 처음부터 다시 맺어 달라는 요청.
     *
     * 협상이 끝난 뒤 미디어 연결만 끊기는 경우가 있다(ICE 실패, 망 전환). 그때 답하는 쪽이
     * 혼자 다시 맺어 봐야 소용이 없다 — offer 를 만드는 쪽은 이미 answer 를 적용해 두어
     * 다시는 offer 를 만들지 않기 때문이다. 이 신호로 그쪽이 협상을 새로 시작하게 한다.
     */
    RENEGOTIATE,
    ERROR,
}
