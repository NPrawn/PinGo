package com.pingo.backend.localization.client;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.Map;

@Validated
@ConfigurationProperties(prefix = "ai.localization")
public record AiLocalizationProperties(
        @NotBlank
        String baseUrl,

        String internalToken,

        @Min(1)
        int connectTimeoutMs,

        @Min(1)
        int readTimeoutMs,

        Map<Long, @NotBlank String> stationMapSets

) {

    public AiLocalizationProperties {
        stationMapSets = stationMapSets == null ? Map.of() : Map.copyOf(stationMapSets);
    }

    public String mapSetVersionFor(Long stationId) {
        return stationId == null ? null : stationMapSets.get(stationId);
    }

}
