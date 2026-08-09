package com.pingo.backend.webrtc.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(IceServerProperties.class)
public class WebRtcConfig {
}
