package com.pingo.backend.route.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.route.dto.request.RouteEdgeCreateRequest;
import com.pingo.backend.route.dto.request.RouteEdgeUpdateRequest;
import com.pingo.backend.route.dto.response.RouteEdgeIdResponse;
import com.pingo.backend.route.dto.response.RouteEdgeResponse;
import com.pingo.backend.route.service.RouteService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/route-edges")
@RequiredArgsConstructor
@Tag(name = "관리자 - 경로 간선 관리 API", description = "관리자가 노드 간 간선과 이동 수단·거리를 등록·조회·수정·삭제하는 API")
public class AdminRouteEdgeController {

    private final RouteService routeService;

    @PostMapping
    public ResponseEntity<ApiResponse<RouteEdgeIdResponse>> createEdge(
            @Valid @RequestBody RouteEdgeCreateRequest request
    ) {
        RouteEdgeIdResponse response = routeService.createEdge(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ApiResponse<List<RouteEdgeResponse>> getEdges(@RequestParam(required = false) Long stationId) {
        return ApiResponse.success(routeService.getEdges(stationId));
    }

    @GetMapping("/{edgeId}")
    public ApiResponse<RouteEdgeResponse> getEdge(@PathVariable Long edgeId) {
        return ApiResponse.success(routeService.getEdge(edgeId));
    }

    @PatchMapping("/{edgeId}")
    public ApiResponse<RouteEdgeResponse> updateEdge(
            @PathVariable Long edgeId,
            @Valid @RequestBody RouteEdgeUpdateRequest request
    ) {
        return ApiResponse.success(routeService.updateEdge(edgeId, request));
    }

    @DeleteMapping("/{edgeId}")
    public ApiResponse<Void> deleteEdge(@PathVariable Long edgeId) {
        routeService.deleteEdge(edgeId);
        return ApiResponse.success();
    }
}
