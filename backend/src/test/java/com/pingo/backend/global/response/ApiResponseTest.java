package com.pingo.backend.global.response;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {

    @Test
    void successWithDataCreatesSuccessResponse() {
        String data = "OK";

        ApiResponse<String> response = ApiResponse.success(data);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getCode()).isNull();
        assertThat(response.getMessage()).isNull();
        assertThat(response.getData()).isEqualTo(data);
    }

    @Test
    void successWithoutDataCreatesSuccessResponse() {
        ApiResponse<Void> response = ApiResponse.success();

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getCode()).isNull();
        assertThat(response.getMessage()).isNull();
        assertThat(response.getData()).isNull();
    }

    @Test
    void successWithMessageCreatesSuccessResponse() {
        String data = "OK";
        String message = "Request succeeded.";

        ApiResponse<String> response = ApiResponse.success(data, message);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getCode()).isNull();
        assertThat(response.getMessage()).isEqualTo(message);
        assertThat(response.getData()).isEqualTo(data);
    }

    @Test
    void failCreatesFailResponse() {
        String code = "INVALID_REQUEST";
        String message = "Invalid request.";

        ApiResponse<Void> response = ApiResponse.fail(code, message);

        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getCode()).isEqualTo(code);
        assertThat(response.getMessage()).isEqualTo(message);
        assertThat(response.getData()).isNull();
    }
}
