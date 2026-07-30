package com.pingo.backend.webrtc.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "webrtc.ice")
public record IceServerProperties(
        List<String> stunUrls,
        List<String> turnUrls,
        String turnUsername,
        String turnCredential
) {
}
