package com.pingo.backend.webrtc.service;

import com.pingo.backend.webrtc.config.IceServerProperties;
import com.pingo.backend.webrtc.dto.IceServerResponse;
import com.pingo.backend.webrtc.dto.IceServersResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IceServerService {

    private final IceServerProperties iceServerProperties;

    public IceServersResponse getIceServers() {
        List<IceServerResponse> iceServers = new ArrayList<>();

        List<String> stunUrls = normalizeUrls(iceServerProperties.stunUrls());
        if (!stunUrls.isEmpty()) {
            iceServers.add(IceServerResponse.stun(stunUrls));
        }

        List<String> turnUrls = normalizeUrls(iceServerProperties.turnUrls());
        if (!turnUrls.isEmpty()
                && StringUtils.hasText(iceServerProperties.turnUsername())
                && StringUtils.hasText(iceServerProperties.turnCredential())) {
            iceServers.add(IceServerResponse.turn(
                    turnUrls,
                    iceServerProperties.turnUsername(),
                    iceServerProperties.turnCredential()
            ));
        }

        return new IceServersResponse(List.copyOf(iceServers));
    }

    private List<String> normalizeUrls(List<String> urls) {
        if (urls == null) {
            return List.of();
        }

        return urls.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList();
    }
}
