package com.pingo.backend.consultation.datachannel;

/**
 * DataChannel 로 오가는 상담 이벤트의 종류.
 *
 * 아래 DRAW_* 는 상담자가 공유 화면 위에 그려 주는 선이다. DataChannel 이 열리지 않은
 * 상담에서는 이 이벤트가 REST 로 올라와 SSE 로 내려간다. 이 목록에 없는 종류는 요청이
 * 400 으로 거절되므로, 프론트가 실제로 보내는 이벤트와 어긋나면 우회로가 통째로 막힌다.
 */
public enum ConsultationDataChannelEventType {
    ARROW_POINTED,
    GUIDE_MESSAGE_SENT,
    DESTINATION_CHANGE_REQUESTED,
    DRAW_STROKE_START,
    DRAW_STROKE_MOVE,
    DRAW_STROKE_END,
    DRAW_CLEAR,
    /** 사용자가 보고 있는 지도(역·층·현재 위치·경로)를 상담자 화면에 그대로 옮기는 스냅숏. */
    MAP_SYNC,
    /** 상담자가 지도에서 사용자의 실제 위치를 짚어 바로잡았다. */
    CURRENT_LOCATION_CORRECTED,
}
