package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.domain.CounselorStatus;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.service.CounselorSelfService;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CounselorSelfControllerTest {

    @Mock
    private CounselorSelfService counselorSelfService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        CounselorSelfController controller = new CounselorSelfController(counselorSelfService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        // JwtAuthenticationFilter가 principal에 accountId(Long)를 그대로 담아두는 것과 동일하게 흉내
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(1L, null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("본인 계정 정보를 조회한다")
    void getMe_returnsOwnAccount() throws Exception {
        when(counselorSelfService.getMe(1L)).thenReturn(
                new AccountDetailResponse(1L, "counselor01", "김상담", 1L, true, CounselorStatus.AVAILABLE, LocalDateTime.now()));

        mockMvc.perform(get("/api/counselors/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accountId").value(1L))
                .andExpect(jsonPath("$.data.name").value("김상담"));
    }

    @Test
    @DisplayName("이름과 상담 가능 상태를 수정한다")
    void updateMe_changesNameAndStatus() throws Exception {
        when(counselorSelfService.updateMe(eq(1L), any())).thenReturn(
                new AccountDetailResponse(1L, "counselor01", "박상담", 1L, true, CounselorStatus.BUSY, LocalDateTime.now()));

        mockMvc.perform(patch("/api/counselors/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"박상담","status":"BUSY"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("박상담"))
                .andExpect(jsonPath("$.data.status").value("BUSY"));
    }

    @Test
    @DisplayName("새 비밀번호 형식이 규칙에 안 맞으면 400을 반환한다")
    void updateMe_invalidPasswordFormat_returns400() throws Exception {
        mockMvc.perform(patch("/api/counselors/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"old1234!","newPassword":"short1!"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("현재 비밀번호가 틀리면 INVALID_CURRENT_PASSWORD를 반환한다")
    void updateMe_wrongCurrentPassword_returns400() throws Exception {
        doThrow(new BusinessException(ErrorCode.INVALID_CURRENT_PASSWORD))
                .when(counselorSelfService).updateMe(eq(1L), any());

        mockMvc.perform(patch("/api/counselors/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword":"wrongPass1!","newPassword":"newPass123!"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURRENT_PASSWORD"));
    }

    @Test
    @DisplayName("존재하지 않는 계정이면 404를 반환한다")
    void getMe_accountNotFound_returns404() throws Exception {
        doThrow(new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND))
                .when(counselorSelfService).getMe(1L);

        mockMvc.perform(get("/api/counselors/me"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_FOUND"));
    }
}