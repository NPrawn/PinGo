package com.pingo.backend.station.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.station.dto.request.FloorCreateRequest;
import com.pingo.backend.station.dto.request.FloorUpdateRequest;
import com.pingo.backend.station.dto.request.StationCreateRequest;
import com.pingo.backend.station.dto.request.StationUpdateRequest;
import com.pingo.backend.station.dto.response.FloorIdResponse;
import com.pingo.backend.station.dto.response.FloorResponse;
import com.pingo.backend.station.dto.response.StationDetailResponse;
import com.pingo.backend.station.dto.response.StationIdResponse;
import com.pingo.backend.station.dto.response.StationResponse;
import com.pingo.backend.station.service.StationService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "관리자 - 역·층 관리 API", description = "관리자가 대상 역과 층 정보를 등록·조회·수정·삭제하는 API")
public class AdminStationController {

    private final StationService stationService;

    @PostMapping("/stations")
    public ResponseEntity<ApiResponse<StationIdResponse>> createStation(
            @Valid @RequestBody StationCreateRequest request
    ) {
        StationIdResponse response = stationService.createStation(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping("/stations")
    public ApiResponse<List<StationResponse>> getStations() {
        return ApiResponse.success(stationService.getStations());
    }

    @GetMapping("/stations/{stationId}")
    public ApiResponse<StationDetailResponse> getStation(@PathVariable Long stationId) {
        return ApiResponse.success(stationService.getStation(stationId));
    }

    @PatchMapping("/stations/{stationId}")
    public ApiResponse<StationDetailResponse> updateStation(
            @PathVariable Long stationId,
            @Valid @RequestBody StationUpdateRequest request
    ) {
        return ApiResponse.success(stationService.updateStation(stationId, request));
    }

    @DeleteMapping("/stations/{stationId}")
    public ApiResponse<Void> deleteStation(@PathVariable Long stationId) {
        stationService.deleteStation(stationId);
        return ApiResponse.success();
    }

    @PostMapping("/stations/{stationId}/floors")
    public ResponseEntity<ApiResponse<FloorIdResponse>> createFloor(
            @PathVariable Long stationId,
            @Valid @RequestBody FloorCreateRequest request
    ) {
        FloorIdResponse response = stationService.createFloor(stationId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping("/stations/{stationId}/floors")
    public ApiResponse<List<FloorResponse>> getFloors(@PathVariable Long stationId) {
        return ApiResponse.success(stationService.getFloors(stationId));
    }

    @PatchMapping("/floors/{floorId}")
    public ApiResponse<FloorResponse> updateFloor(
            @PathVariable Long floorId,
            @Valid @RequestBody FloorUpdateRequest request
    ) {
        return ApiResponse.success(stationService.updateFloor(floorId, request));
    }

    @DeleteMapping("/floors/{floorId}")
    public ApiResponse<Void> deleteFloor(@PathVariable Long floorId) {
        stationService.deleteFloor(floorId);
        return ApiResponse.success();
    }
}
