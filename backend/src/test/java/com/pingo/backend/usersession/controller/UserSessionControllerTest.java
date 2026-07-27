package com.pingo.backend.usersession.controller;


import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

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
    void language를_생략하면_기본값_ko로_생성된다() throws Exception {
        mockMvc.perform(post("/api/user-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.language").value("ko"));
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