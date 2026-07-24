package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.response.SignupResponse;
import com.pingo.backend.auth.service.AuthService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AuthController controller = new AuthController(authService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("회원가입 정상 요청은 200과 생성된 accountId를 반환한다")
    void signupReturnsAccountId() throws Exception {
        when(authService.signup(any()))
                .thenReturn(new SignupResponse(10L, "counselor01", "김상담", 1L));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"counselor01","password":"pw12345!","name":"김상담","stationId":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accountId").value(10L));
    }

    @Test
    @DisplayName("필수 값이 누락되면 400과 INVALID_REQUEST를 반환한다")
    void signupRejectsMissingField() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"password":"pw12345!","name":"김상담","stationId":1}
                                """)) // loginId 누락
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("이미 사용 중인 아이디로 가입하면 409와 DUPLICATE_LOGIN_ID를 반환한다")
    void signupRejectsDuplicateLoginId() throws Exception {
        when(authService.signup(any()))
                .thenThrow(new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID));

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"counselor01","password":"pw12345!","name":"김상담","stationId":1}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_LOGIN_ID"));
    }

    @Test
    @DisplayName("사용 가능한 아이디는 true와 안내 메시지를 반환한다")
    void checkLoginIdAvailable() throws Exception {
        when(authService.isLoginIdAvailable("newuser")).thenReturn(true);

        mockMvc.perform(get("/api/auth/check-login-id").param("loginId", "newuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true))
                .andExpect(jsonPath("$.message").value("사용 가능한 아이디입니다."));
    }

    @Test
    @DisplayName("이미 사용 중인 아이디는 false와 안내 메시지를 반환한다")
    void checkLoginIdTaken() throws Exception {
        when(authService.isLoginIdAvailable("counselor01")).thenReturn(false);

        mockMvc.perform(get("/api/auth/check-login-id").param("loginId", "counselor01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(false))
                .andExpect(jsonPath("$.message").value("이미 사용 중인 아이디입니다."));
    }
}