package com.pingo.backend.auth.controller;

import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.dto.response.AccountListResponse;
import com.pingo.backend.auth.service.AdminAccountService;
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

import java.util.List;

import static java.time.LocalDateTime.now;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminAccountControllerTest {

    @Mock
    private AdminAccountService adminAccountService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminAccountController controller = new AdminAccountController(adminAccountService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("상담자 목록을 필터(stationId·isActive)로 조회한다")
    void listReturnsCounselors() throws Exception {
        // ※ AccountListResponse 생성자는 실제 DTO에 맞게 조정 (status는 null로 둬서 enum 값 가정 회피)
        when(adminAccountService.listCounselors(1L, true)).thenReturn(List.of(
                new AccountListResponse(10L, "counselor01", "김상담", 1L, true, null)));

        mockMvc.perform(get("/api/admin/counselors")
                        .param("stationId", "1")
                        .param("isActive", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].accountId").value(10L))
                .andExpect(jsonPath("$.data[0].name").value("김상담"));
    }

    @Test
    @DisplayName("필터 없이도 상담자 목록을 조회한다")
    void listReturnsAllWithoutFilter() throws Exception {
        when(adminAccountService.listCounselors(null, null)).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/counselors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("상담자 정보를 수정한다")
    void updateReturnsUpdated() throws Exception {
        // ※ AccountDetailResponse 생성자는 실제 DTO에 맞게 조정
        when(adminAccountService.updateCounselor(eq(10L), any())).thenReturn(
                new AccountDetailResponse(10L, "counselor01", "박상담", 2L, true, null, now()));

        mockMvc.perform(patch("/api/admin/counselors/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"박상담","stationId":2}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accountId").value(10L))
                .andExpect(jsonPath("$.data.name").value("박상담"));
    }

    @Test
    @DisplayName("상담자를 비활성화한다")
    void deactivateReturnsSuccess() throws Exception {
        mockMvc.perform(delete("/api/admin/counselors/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    @DisplayName("존재하지 않는 상담자를 비활성화하면 404를 반환한다")
    void deactivateNotFound() throws Exception {
        // ※ 실제 ErrorCode 이름/상태에 맞게 조정 (예: ACCOUNT_NOT_FOUND, 404)
        doThrow(new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND))
                .when(adminAccountService).deactivateCounselor(99L);

        mockMvc.perform(delete("/api/admin/counselors/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ACCOUNT_NOT_FOUND"));
    }
}