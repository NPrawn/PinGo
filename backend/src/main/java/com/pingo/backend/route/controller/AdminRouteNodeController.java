package com.pingo.backend.route.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.route.dto.request.RouteNodeCreateRequest;
import com.pingo.backend.route.dto.request.RouteNodeUpdateRequest;
import com.pingo.backend.route.dto.response.RouteNodeIdResponse;
import com.pingo.backend.route.dto.response.RouteNodeResponse;
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
@RequestMapping("/api/admin/route-nodes")
@RequiredArgsConstructor
@Tag(name = "관리자 - 경로 노드 관리 API", description = "관리자가 경로 탐색용 노드를 등록·조회·수정·삭제하는 API")
public class AdminRouteNodeController {

    private final RouteService routeService;

    @PostMapping
    public ResponseEntity<ApiResponse<RouteNodeIdResponse>> createNode(
            @Valid @RequestBody RouteNodeCreateRequest request
    ) {
        RouteNodeIdResponse response = routeService.createNode(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ApiResponse<List<RouteNodeResponse>> getNodes(
            @RequestParam(required = false) Long stationId,
            @RequestParam(required = false) Long floorId
    ) {
        return ApiResponse.success(routeService.getNodes(stationId, floorId));
    }

    @GetMapping("/{nodeId}")
    public ApiResponse<RouteNodeResponse> getNode(@PathVariable Long nodeId) {
        return ApiResponse.success(routeService.getNode(nodeId));
    }

    @PatchMapping("/{nodeId}")
    public ApiResponse<RouteNodeResponse> updateNode(
            @PathVariable Long nodeId,
            @Valid @RequestBody RouteNodeUpdateRequest request
    ) {
        return ApiResponse.success(routeService.updateNode(nodeId, request));
    }

    @DeleteMapping("/{nodeId}")
    public ApiResponse<Void> deleteNode(@PathVariable Long nodeId) {
        routeService.deleteNode(nodeId);
        return ApiResponse.success();
    }
}
