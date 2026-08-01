package com.pingo.backend.floormap.controller;

import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.service.FloorMapService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stations")
@RequiredArgsConstructor
@Tag(name = "층별 지도 API", description = "비로그인 사용자가 역의 층별 도면과 좌표 프레임을 조회하는 API")
public class FloorMapController {

    private final FloorMapService floorMapService;

    @GetMapping("/{stationId}/maps")
    public ApiResponse<List<FloorMapResponse>> getStationMaps(@PathVariable Long stationId) {
        return ApiResponse.success(floorMapService.getMapsByStation(stationId));
    }
}
