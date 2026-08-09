package com.pingo.backend.global.exception;

import com.pingo.backend.global.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 전역 예외 처리.
 *
 * <p>맨 아래 {@code Exception} 핸들러가 최후의 그물이라, 표준 MVC 예외를 명시적으로 잡지 않으면
 * 전부 500 으로 나간다. 라우팅이나 메서드 실수인데 서버가 죽은 것처럼 보이게 된다.
 *
 * <p><b>{@code ResponseEntityExceptionHandler} 를 상속하지 않는다.</b> 그쪽 기본 응답은
 * {@code ProblemDetail} 형식이라 이 프로젝트의 {@link ApiResponse} 봉투와 맞지 않는다. 봉투를
 * 유지하려면 {@code handleExceptionInternal} 을 재정의해 본문을 다시 만들어야 하고, 그러고 나서도
 * {@code code} 를 의미 있게 채우려면 예외별 {@link ErrorCode} 대응표가 그대로 필요하다. 얻는 것은
 * 지금 발생하지 않는 예외들의 처리이고, 대신 공용 파일에서 십수 개 예외의 응답 형태가 한꺼번에
 * 바뀐다. 그래서 실제로 확인된 것만 명시적으로 잡는다.
 */
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
            MethodArgumentTypeMismatchException.class,
            ConstraintViolationException.class
    })
    public ResponseEntity<ApiResponse<Void>> handleInvalidRequestException(Exception exception) {
        ErrorCode errorCode = ErrorCode.INVALID_REQUEST;

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.fail(errorCode.getCodeName(), errorCode.getMessage()));
    }

    /**
     * 경로는 있으나 메서드가 다른 요청. 405 로 답한다.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException exception) {
        ErrorCode errorCode = ErrorCode.METHOD_NOT_ALLOWED;

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ApiResponse.fail(errorCode.getCodeName(), errorCode.getMessage()));
    }

    /**
     * 본문 형식을 서버가 읽을 수 없는 요청. 415 로 답한다.
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaTypeNotSupported(
            HttpMediaTypeNotSupportedException exception) {
        ErrorCode errorCode = ErrorCode.UNSUPPORTED_MEDIA_TYPE;

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
