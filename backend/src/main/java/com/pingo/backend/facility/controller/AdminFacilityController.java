package com.pingo.backend.facility.controller;

import com.pingo.backend.facility.dto.request.FacilityCreateRequest;
import com.pingo.backend.facility.dto.request.FacilityUpdateRequest;
import com.pingo.backend.facility.dto.response.FacilityDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityIdResponse;
import com.pingo.backend.facility.dto.response.FacilityResponse;
import com.pingo.backend.facility.service.FacilityService;
import com.pingo.backend.global.response.ApiResponse;
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
@RequestMapping("/api/admin/facilities")
@RequiredArgsConstructor
@Tag(name = "관리자 - 시설·출구 관리 API", description = "관리자가 역 내부 시설과 출구를 등록·조회·수정·삭제하는 API")
public class AdminFacilityController {

    private final FacilityService facilityService;

    @PostMapping
    public ResponseEntity<ApiResponse<FacilityIdResponse>> createFacility(
            @Valid @RequestBody FacilityCreateRequest request
    ) {
        FacilityIdResponse response = facilityService.createFacility(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ApiResponse<List<FacilityResponse>> getFacilities(
            @RequestParam Long stationId,
            @RequestParam(required = false) Long floorId,
            @RequestParam(required = false) String facilityType
    ) {
        return ApiResponse.success(facilityService.getFacilities(stationId, floorId, facilityType));
    }

    @GetMapping("/{facilityId}")
    public ApiResponse<FacilityDetailResponse> getFacility(@PathVariable Long facilityId) {
        return ApiResponse.success(facilityService.getFacility(facilityId));
    }

    @PatchMapping("/{facilityId}")
    public ApiResponse<FacilityDetailResponse> updateFacility(
            @PathVariable Long facilityId,
            @Valid @RequestBody FacilityUpdateRequest request
    ) {
        return ApiResponse.success(facilityService.updateFacility(facilityId, request));
    }

    @DeleteMapping("/{facilityId}")
    public ApiResponse<Void> deleteFacility(@PathVariable Long facilityId) {
        facilityService.deleteFacility(facilityId);
        return ApiResponse.success();
    }
}
