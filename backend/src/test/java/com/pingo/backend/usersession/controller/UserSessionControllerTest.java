package com.pingo.backend.usersession.controller;


import com.pingo.backend.global.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class UserSessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 생성된_세션을_조회하면_현재_상태가_반환된다() throws Exception {
        String userSessionId = createSession("en");

        mockMvc.perform(get("/api/user-sessions/{userSessionId}", userSessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userSessionId").value(userSessionId))
                .andExpect(jsonPath("$.data.language").value("en"))
                .andExpect(jsonPath("$.data.expiresAt").exists());
    }

    @Test
    void 세션을_종료하면_data가_true로_반환된다() throws Exception {
        String userSessionId = createSession("ko");

        mockMvc.perform(delete("/api/user-sessions/{userSessionId}", userSessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));
    }

    @Test
    void 이미_종료된_세션을_다시_종료하면_클라이언트_에러가_반환된다() throws Exception {
        String userSessionId = createSession("ko");
        mockMvc.perform(delete("/api/user-sessions/{userSessionId}", userSessionId));

        mockMvc.perform(delete("/api/user-sessions/{userSessionId}", userSessionId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void 종료된_세션을_조회하면_클라이언트_에러가_반환된다() throws Exception {
        String userSessionId = createSession("ko");
        mockMvc.perform(delete("/api/user-sessions/{userSessionId}", userSessionId));

        mockMvc.perform(get("/api/user-sessions/{userSessionId}", userSessionId))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void language를_지정해서_생성하면_200과_생성된_정보가_반환된다() throws Exception {
        mockMvc.perform(post("/api/user-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"language":"en"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userSessionId").exists())
                .andExpect(jsonPath("$.data.language").value("en"))
                .andExpect(jsonPath("$.data.expiresAt").exists());
    }

    @Test
    void language를_생략하면_기본값_en로_생성된다() throws Exception {
        mockMvc.perform(post("/api/user-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.language").value("en"));
    }

    @Test
    void 지원하지_않는_language_값이면_400이_반환된다() throws Exception {
        mockMvc.perform(post("/api/user-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"language":"fr"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 생성된_세션을_수정하면_변경된_필드가_응답에_반영된다() throws Exception {
        String userSessionId = createSession("ko");

        mockMvc.perform(patch("/api/user-sessions/{userSessionId}", userSessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"language":"en"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.language").value("en"));
    }

    @Test
    void 존재하지_않는_userSessionId를_수정하면_클라이언트_에러가_반환된다() throws Exception {
        mockMvc.perform(patch("/api/user-sessions/{userSessionId}", "존재하지-않는-id")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"language":"en"}
                                """))
                .andExpect(status().is4xxClientError());
    }

    private String createSession(String language) throws Exception {
        String response = mockMvc.perform(post("/api/user-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(String.format("{\"language\":\"%s\"}", language)))
                .andReturn().getResponse().getContentAsString();

        return objectMapper.readTree(response).get("data").get("userSessionId").asText();
    }
}