package com.pingo.backend.webrtc.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.webrtc.dto.IceServersResponse;
import com.pingo.backend.webrtc.service.IceServerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "WebRTC")
@RestController
@RequestMapping("/api/webrtc")
@RequiredArgsConstructor
public class WebRtcController {

    private final IceServerService iceServerService;

    @Operation(summary = "WebRTC ICE 서버 설정 조회")
    @GetMapping("/ice-servers")
    public ApiResponse<IceServersResponse> getIceServers() {
        return ApiResponse.success(iceServerService.getIceServers());
    }
}
