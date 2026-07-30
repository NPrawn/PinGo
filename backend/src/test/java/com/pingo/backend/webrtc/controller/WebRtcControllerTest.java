package com.pingo.backend.webrtc.controller;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.webrtc.dto.IceServerResponse;
import com.pingo.backend.webrtc.dto.IceServersResponse;
import com.pingo.backend.webrtc.service.IceServerAccessValidator;
import com.pingo.backend.webrtc.service.IceServerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = WebRtcController.class)
@AutoConfigureMockMvc(addFilters = false)
class WebRtcControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IceServerService iceServerService;

    @MockitoBean
    private IceServerAccessValidator iceServerAccessValidator;

    @Test
    void getIceServersReturnsConfiguredIceServers() throws Exception {
        given(iceServerService.getIceServers())
                .willReturn(new IceServersResponse(List.of(
                        IceServerResponse.stun(List.of("stun:stun.l.google.com:19302")),
                        IceServerResponse.turn(List.of("turn:turn.example.com:3478"), "turn-user", "turn-secret")
                )));

        mockMvc.perform(get("/api/webrtc/ice-servers")
                        .param("token", "signaling-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.iceServers[0].urls[0]").value("stun:stun.l.google.com:19302"))
                .andExpect(jsonPath("$.data.iceServers[0].username").doesNotExist())
                .andExpect(jsonPath("$.data.iceServers[1].urls[0]").value("turn:turn.example.com:3478"))
                .andExpect(jsonPath("$.data.iceServers[1].username").value("turn-user"))
                .andExpect(jsonPath("$.data.iceServers[1].credential").value("turn-secret"));

        verify(iceServerAccessValidator).validate("signaling-token");
    }

    @Test
    void getIceServersReturnsUnauthorizedWhenTokenIsMissing() throws Exception {
        doThrow(new BusinessException(ErrorCode.UNAUTHENTICATED))
                .when(iceServerAccessValidator).validate(null);

        mockMvc.perform(get("/api/webrtc/ice-servers"))
                .andExpect(status().isUnauthorized());

        verify(iceServerService, never()).getIceServers();
    }

    @Test
    void getIceServersReturnsUnauthorizedWhenTokenIsInvalid() throws Exception {
        doThrow(new BusinessException(ErrorCode.UNAUTHENTICATED))
                .when(iceServerAccessValidator).validate("invalid-token");

        mockMvc.perform(get("/api/webrtc/ice-servers")
                        .param("token", "invalid-token"))
                .andExpect(status().isUnauthorized());

        verify(iceServerService, never()).getIceServers();
    }
}
