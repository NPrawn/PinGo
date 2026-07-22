package com.pingo.backend.station.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.station.dto.response.StationDetailResponse;
import com.pingo.backend.station.service.StationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
public class StationController {

    private final StationService stationService;

    @GetMapping("/{stationId}")
    public ApiResponse<StationDetailResponse> getStation(@PathVariable Long stationId) {
        return ApiResponse.success(stationService.getStation(stationId));
    }
}
