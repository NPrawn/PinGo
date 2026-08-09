package com.pingo.backend.route.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.route.dto.request.RouteCreateRequest;
import com.pingo.backend.route.dto.request.RouteOptionsRequest;
import com.pingo.backend.route.dto.response.RouteOptionResponse;
import com.pingo.backend.route.dto.response.RouteResponse;
import com.pingo.backend.route.service.IndoorRouteService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
@Tag(name = "실내 경로 API", description = "비로그인 사용자가 실내 경로 옵션과 상세 경로를 조회하는 API")
public class IndoorRouteController {

    private final IndoorRouteService indoorRouteService;

    @PostMapping("/indoor/options")
    public ApiResponse<List<RouteOptionResponse>> getRouteOptions(
            @Valid @RequestBody RouteOptionsRequest request
    ) {
        return ApiResponse.success(indoorRouteService.getRouteOptions(request));
    }

    @PostMapping("/indoor")
    public ApiResponse<RouteResponse> createRoute(
            @Valid @RequestBody RouteCreateRequest request
    ) {
        return ApiResponse.success(indoorRouteService.createRoute(request));
    }
}
