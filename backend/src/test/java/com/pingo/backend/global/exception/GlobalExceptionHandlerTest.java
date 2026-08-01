package com.pingo.backend.global.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 존재하지 않는 경로의 응답을 고정한다.
 *
 * <p>{@code @ExceptionHandler(Exception.class)} 가 {@code NoResourceFoundException} 까지 삼켜
 * 오타 경로가 500 으로 나가고 있었다. 클라이언트 입장에서는 서버가 죽은 것과 구분되지 않는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("화이트리스트 아래 없는 경로는 404를 반환한다")
    void returnsNotFoundForUnmappedPathUnderWhitelistedPrefix() throws Exception {
        // 시큐리티가 통과시키는 접두사라 여기까지 온다. 이전에는 500 이 나갔다.
        mockMvc.perform(get("/api/external-maps/providers"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
    }

    @Test
    @DisplayName("자원을 못 찾은 경우의 404는 그대로다")
    void keepsDomainNotFoundBehaviour() throws Exception {
        // 경로는 있고 자원이 없는 경우. 도메인 오류코드가 그대로 나가야 한다.
        mockMvc.perform(get("/api/facilities/99999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FACILITY_NOT_FOUND"));
    }
}
