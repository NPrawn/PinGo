package com.pingo.backend.floormap.controller;

import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.service.FloorMapService;
import com.pingo.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
public class FloorMapController {

    private final FloorMapService floorMapService;

    @GetMapping("/{stationId}/maps")
    public ApiResponse<List<FloorMapResponse>> getStationMaps(@PathVariable Long stationId) {
        return ApiResponse.success(floorMapService.getMapsByStation(stationId));
    }
}
