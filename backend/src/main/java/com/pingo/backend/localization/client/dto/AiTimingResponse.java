package com.pingo.backend.localization.client.dto;

public record AiTimingResponse(
        Integer total,
        Integer validation,
        Integer queue,
        Integer inference
) {

}
