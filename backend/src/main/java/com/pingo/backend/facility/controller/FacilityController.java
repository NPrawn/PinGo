package com.pingo.backend.facility.controller;

import com.pingo.backend.facility.dto.response.FacilityDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityResponse;
import com.pingo.backend.facility.service.FacilityService;
import com.pingo.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class FacilityController {

    private final FacilityService facilityService;

    @GetMapping("/stations/{stationId}/facilities")
    public ApiResponse<List<FacilityResponse>> getStationFacilities(
            @PathVariable Long stationId,
            @RequestParam(required = false) Long floorId,
            @RequestParam(required = false) String facilityType,
            @RequestParam(required = false) String language
    ) {
        return ApiResponse.success(facilityService.getFacilities(stationId, floorId, facilityType));
    }

    @GetMapping("/facilities/{facilityId}")
    public ApiResponse<FacilityDetailResponse> getFacility(@PathVariable Long facilityId) {
        return ApiResponse.success(facilityService.getFacility(facilityId));
    }
}
