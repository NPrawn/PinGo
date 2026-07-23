package com.pingo.backend.global.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "요청 형식이 올바르지 않습니다."),
    DUPLICATE_LOGIN_ID(HttpStatus.CONFLICT, "DUPLICATE_LOGIN_ID", "이미 사용 중인 로그인 ID입니다."),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 올바르지 않습니다."),
    INACTIVE_ACCOUNT(HttpStatus.FORBIDDEN, "INACTIVE_ACCOUNT", "비활성화된 계정입니다."),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "인증이 필요합니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "접근 권한이 없습니다."),
    STATION_NOT_FOUND(HttpStatus.NOT_FOUND, "STATION_NOT_FOUND", "역을 찾을 수 없습니다."),
    FLOOR_NOT_FOUND(HttpStatus.NOT_FOUND, "FLOOR_NOT_FOUND", "층을 찾을 수 없습니다."),
    FACILITY_NOT_FOUND(HttpStatus.NOT_FOUND, "FACILITY_NOT_FOUND", "시설을 찾을 수 없습니다."),
    UNSUPPORTED_FACILITY_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FACILITY_TYPE", "지원하지 않는 시설 유형입니다."),
    PLACE_NOT_FOUND(HttpStatus.NOT_FOUND, "PLACE_NOT_FOUND", "주변 장소를 찾을 수 없습니다."),
    DUPLICATE_FLOOR_CODE(HttpStatus.CONFLICT, "DUPLICATE_FLOOR_CODE", "해당 역에 동일한 층 코드가 존재합니다."),
    FLOOR_IN_USE(HttpStatus.CONFLICT, "FLOOR_IN_USE", "사용 중인 층은 삭제할 수 없습니다."),
    INVALID_MAP_FILE(HttpStatus.BAD_REQUEST, "INVALID_MAP_FILE", "지도 파일이 비어 있거나 올바르지 않습니다."),
    UNSUPPORTED_MAP_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MAP_TYPE", "지원하지 않는 지도 유형입니다."),
    FILE_STORAGE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_STORAGE_FAILED", "파일 저장에 실패했습니다."),
    ROUTE_NODE_NOT_FOUND(HttpStatus.NOT_FOUND, "ROUTE_NODE_NOT_FOUND", "경로 노드를 찾을 수 없습니다."),
    ROUTE_EDGE_NOT_FOUND(HttpStatus.NOT_FOUND, "ROUTE_EDGE_NOT_FOUND", "경로 간선을 찾을 수 없습니다."),
    ROUTE_NODE_IN_USE(HttpStatus.CONFLICT, "ROUTE_NODE_IN_USE", "사용 중인 경로 노드는 삭제할 수 없습니다."),
    UNSUPPORTED_NODE_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_NODE_TYPE", "지원하지 않는 노드 유형입니다."),
    UNSUPPORTED_MOVE_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_MOVE_TYPE", "지원하지 않는 이동 유형입니다."),
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
