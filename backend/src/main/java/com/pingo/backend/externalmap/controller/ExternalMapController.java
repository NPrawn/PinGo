package com.pingo.backend.externalmap.controller;

import com.pingo.backend.externalmap.dto.request.ExternalDirectionRequest;
import com.pingo.backend.externalmap.dto.response.ExternalDirectionResponse;
import com.pingo.backend.externalmap.service.ExternalMapService;
import com.pingo.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exteranl-maps")
@RequiredArgsConstructor
public class ExternalMapController {

    private final ExternalMapService externalMapService;

    @PostMapping("/directions")
    public ApiResponse<ExternalDirectionResponse> createDirection(
            @Valid @RequestBody ExternalDirectionRequest request
    ) {
        return ApiResponse.success(externalMapService.createDirection(request));
    }
}
