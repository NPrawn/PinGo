package com.pingo.backend.externalmap.client;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "kakao.local")
public record KakaoLocalProperties(
        @NotBlank
        String baseUrl,

        String restApiKey,

        @Min(1)
        int connectTimeoutMs,

        @Min(1)
        int readTimeoutMs
) {
}
