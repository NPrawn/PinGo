package com.pingo.backend.global.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    // 공통

    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "요청 형식이 올바르지 않습니다."),

    // 인증 계정
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다."),
    INVALID_CURRENT_PASSWORD(HttpStatus.BAD_REQUEST, "INVALID_CURRENT_PASSWORD", "현재 비밀번호가 올바르지 않습니다."),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "인증이 필요합니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "접근 권한이 없습니다."),
    INACTIVE_ACCOUNT(HttpStatus.FORBIDDEN, "INACTIVE_ACCOUNT", "비활성화된 계정입니다."),
    ACCOUNT_NOT_FOUND(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "계정을 찾을 수 없습니다."),
    DUPLICATE_LOGIN_ID(HttpStatus.CONFLICT, "DUPLICATE_LOGIN_ID", "이미 사용 중인 로그인 ID입니다."),
 
    // 사용자 세션
    USER_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_SESSION_NOT_FOUND", "사용자 세션을 찾을 수 없습니다."),
    USER_SESSION_IN_CONSULTATION(HttpStatus.CONFLICT, "USER_SESSION_IN_CONSULTATION", "진행 중인 상담이 있어 세션을 종료할 수 없습니다."),
    INVALID_DESTINATION(HttpStatus.BAD_REQUEST, "INVALID_DESTINATION", "목적지 양식이 올바르지 않습니다."),
    USER_SESSION_ALREADY_ENDED(HttpStatus.CONFLICT, "USER_SESSION_ALREADY_ENDED", "이미 종료된 세션입니다."),

    // 상담 세션
    CONSULTATION_NOT_FOUND(HttpStatus.NOT_FOUND, "CONSULTATION_NOT_FOUND", "상담 세션을 찾을 수 없습니다."),
    CONSULTATION_NOT_CANCELABLE(HttpStatus.BAD_REQUEST, "CONSULTATION_NOT_CANCELABLE", "취소할 수 없는 상담 상태입니다."),
    CONSULTATION_ALREADY_IN_PROGRESS(HttpStatus.CONFLICT, "CONSULTATION_ALREADY_IN_PROGRESS", "이미 대기 중이거나 진행 중인 상담이 있습니다."),
    CONSULTATION_NOT_ACCEPTABLE(HttpStatus.CONFLICT, "CONSULTATION_NOT_ACCEPTABLE", "수락할 수 없는 상담 상태입니다."),
    CONSULTATION_NOT_REJECTABLE(HttpStatus.CONFLICT, "CONSULTATION_NOT_REJECTABLE", "거절할 수 없는 상담 상태입니다."),
    CONSULTATION_NOT_ENDABLE(HttpStatus.CONFLICT, "CONSULTATION_NOT_ENDABLE", "종료할 수 없는 상담 상태입니다."),
    CONSULTATION_STATION_MISMATCH(HttpStatus.FORBIDDEN, "CONSULTATION_STATION_MISMATCH", "담당 역의 상담 요청이 아닙니다."),
    CONSULTATION_COUNSELOR_MISMATCH(HttpStatus.FORBIDDEN, "CONSULTATION_COUNSELOR_MISMATCH", "담당 상담자가 아닙니다."),
    COUNSELOR_NOT_AVAILABLE(HttpStatus.CONFLICT, "COUNSELOR_NOT_AVAILABLE", "상담자가 상담 가능한 상태가 아닙니다."),

    // 역,층,시설
    STATION_NOT_FOUND(HttpStatus.NOT_FOUND, "STATION_NOT_FOUND", "역을 찾을 수 없습니다."),
    FLOOR_NOT_FOUND(HttpStatus.NOT_FOUND, "FLOOR_NOT_FOUND", "층을 찾을 수 없습니다."),
    FACILITY_NOT_FOUND(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "시설을 찾을 수 없습니다."),
    UNSUPPORTED_FACILITY_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FACILITY_TYPE", "지원하지 않는 시설 유형입니다."),
    NOT_EXIT_FACILITY(HttpStatus.BAD_REQUEST, "NOT_EXIT_FACILITY", "출구가 아닌 시설입니다."),
    DUPLICATE_FLOOR_CODE(HttpStatus.CONFLICT, "DUPLICATE_FLOOR_CODE", "해당 역에 동일한 층 코드가 존재합니다."),
    FLOOR_IN_USE(HttpStatus.CONFLICT, "FLOOR_IN_USE", "사용 중인 층은 삭제할 수 없습니다."),

    // 장소,출구 추천
    PLACE_NOT_FOUND(HttpStatus.NOT_FOUND, "PLACE_NOT_FOUND", "주변 장소를 찾을 수 없습니다."),
    EXIT_RECOMMENDATION_NOT_FOUND(HttpStatus.NOT_FOUND, "EXIT_RECOMMENDATION_NOT_FOUND", "장소-출구 추천을 찾을 수 없습니다."),
    DUPLICATE_EXIT_RECOMMENDATION(HttpStatus.CONFLICT, "DUPLICATE_EXIT_RECOMMENDATION", "이미 등록된 장소-출구 추천입니다."),

    // 지도,파일
    INVALID_MAP_FILE(HttpStatus.BAD_REQUEST, "INVALID_MAP_FILE", "지도 파일이 비어 있거나 올바르지 않습니다."),
    UNSUPPORTED_MAP_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MAP_TYPE", "지원하지 않는 지도 유형입니다."),
    FILE_STORAGE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_STORAGE_FAILED", "파일 저장에 실패했습니다."),


    // 경로 
    ROUTE_NODE_NOT_FOUND(HttpStatus.NOT_FOUND, "ROUTE_NODE_NOT_FOUND", "경로 노드를 찾을 수 없습니다."),
    ROUTE_EDGE_NOT_FOUND(HttpStatus.NOT_FOUND, "ROUTE_EDGE_NOT_FOUND", "경로 간선을 찾을 수 없습니다."),
    ROUTE_NODE_IN_USE(HttpStatus.CONFLICT, "ROUTE_NODE_IN_USE", "사용 중인 경로 노드는 삭제할 수 없습니다."),
    UNSUPPORTED_NODE_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_NODE_TYPE", "지원하지 않는 노드 유형입니다."),
    UNSUPPORTED_MOVE_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MOVE_TYPE", "지원하지 않는 이동 유형입니다."),
    UNSUPPORTED_ROUTE_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_ROUTE_TYPE", "지원하지 않는 경로 옵션 유형입니다."),

    // 서버
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String codeName;
    private final String message;

    ErrorCode(HttpStatus status, String codeName, String message) {
        this.status = status;
        this.codeName = codeName;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCodeName() {
        return codeName;
    }

    public String getMessage() {
        return message;
    }
}
