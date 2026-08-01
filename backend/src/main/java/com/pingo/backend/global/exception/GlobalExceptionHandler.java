package com.pingo.backend.global.exception;

import com.pingo.backend.global.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException exception) {
        ErrorCode errorCode = exception.getErrorCode();

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.fail(errorCode.getCodeName(), exception.getMessage()));
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            MissingServletRequestParameterException.class,
            MissingServletRequestPartException.class,
            HttpMessageNotReadableException.class,
            ConstraintViolationException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleInvalidRequestException(Exception exception) {
        ErrorCode errorCode = ErrorCode.INVALID_REQUEST;

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.fail(errorCode.getCodeName(), errorCode.getMessage()));
    }

    /**
     * 매핑된 핸들러가 없는 요청. 아래 {@code Exception} 핸들러보다 먼저 잡아야 한다.
     *
     * <p>이것이 없으면 존재하지 않는 경로가 500 으로 나간다. 시큐리티 화이트리스트 접두사 아래의
     * 오타 경로가 특히 그런데({@code GET /api/external-maps/providers}), 클라이언트 입장에서는
     * 서버가 죽은 것과 구분되지 않는다.
     *
     * <p>화이트리스트 밖 경로는 시큐리티가 먼저 401 로 막으므로 여기까지 오지 않는다.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoResourceFoundException(NoResourceFoundException exception) {
        ErrorCode errorCode = ErrorCode.ENDPOINT_NOT_FOUND;

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.fail(errorCode.getCodeName(), errorCode.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception exception) {
        ErrorCode errorCode = ErrorCode.INTERNAL_SERVER_ERROR;

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.fail(errorCode.getCodeName(), errorCode.getMessage()));
    }
}
