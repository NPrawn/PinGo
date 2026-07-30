package com.pingo.backend.webrtc.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.webrtc.dto.IceServersResponse;
import com.pingo.backend.webrtc.service.IceServerAccessValidator;
import com.pingo.backend.webrtc.service.IceServerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "WebRTC")
@RestController
@RequestMapping("/api/webrtc")
@RequiredArgsConstructor
public class WebRtcController {

    private static final String BEARER_PREFIX = "Bearer ";

    private final IceServerService iceServerService;
    private final IceServerAccessValidator iceServerAccessValidator;

    @Operation(summary = "WebRTC ICE 서버 설정 조회")
    @GetMapping("/ice-servers")
    public ApiResponse<IceServersResponse> getIceServers(
            @RequestParam(required = false) String token,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        iceServerAccessValidator.validate(resolveToken(token, authorization));
        return ApiResponse.success(iceServerService.getIceServers());
    }

    private String resolveToken(String queryToken, String authorization) {
        if (StringUtils.hasText(queryToken)) {
            return queryToken;
        }

        if (StringUtils.hasText(authorization) && authorization.startsWith(BEARER_PREFIX)) {
            return authorization.substring(BEARER_PREFIX.length());
        }

        return null;
    }
}
