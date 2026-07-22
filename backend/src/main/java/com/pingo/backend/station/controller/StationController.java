package com.pingo.backend.station.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.station.dto.response.StationDetailResponse;
import com.pingo.backend.station.dto.response.StationNearbyResponse;
import com.pingo.backend.station.dto.response.StationSearchResponse;
import com.pingo.backend.station.service.StationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
public class StationController {

    private final StationService stationService;

    @GetMapping("/nearby")
    public ApiResponse<List<StationNearbyResponse>> getNearbyStations(
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude
    ) {
        return ApiResponse.success(stationService.getNearbyStations(latitude, longitude));
    }

    @GetMapping("/search")
    public ApiResponse<List<StationSearchResponse>> searchStations(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String language
    ) {
        return ApiResponse.success(stationService.searchStations(keyword));
    }

    @GetMapping("/{stationId}")
    public ApiResponse<StationDetailResponse> getStation(@PathVariable Long stationId) {
        return ApiResponse.success(stationService.getStation(stationId));
    }
}
