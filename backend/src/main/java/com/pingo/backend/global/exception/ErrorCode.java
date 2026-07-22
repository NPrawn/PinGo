package com.pingo.backend.global.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "요청 형식이 올바르지 않습니다."),
    STATION_NOT_FOUND(HttpStatus.NOT_FOUND, "STATION_NOT_FOUND", "역을 찾을 수 없습니다."),
    FLOOR_NOT_FOUND(HttpStatus.NOT_FOUND, "FLOOR_NOT_FOUND", "층을 찾을 수 없습니다."),
    DUPLICATE_FLOOR_CODE(HttpStatus.CONFLICT, "DUPLICATE_FLOOR_CODE", "해당 역에 동일한 층 코드가 존재합니다."),
    FLOOR_IN_USE(HttpStatus.CONFLICT, "FLOOR_IN_USE", "사용 중인 층은 삭제할 수 없습니다."),
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
