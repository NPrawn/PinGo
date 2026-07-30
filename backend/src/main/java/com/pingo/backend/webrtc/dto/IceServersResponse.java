package com.pingo.backend.webrtc.dto;

import java.util.List;

public record IceServersResponse(
        List<IceServerResponse> iceServers
) {
}
