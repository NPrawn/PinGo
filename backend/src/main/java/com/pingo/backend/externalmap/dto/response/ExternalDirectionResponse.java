package com.pingo.backend.externalmap.dto.response;

public record ExternalDirectionResponse(
        String provider,
        String appUrl,
        String webUrl
) {

}
