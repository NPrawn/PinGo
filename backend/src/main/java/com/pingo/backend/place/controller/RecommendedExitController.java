package com.pingo.backend.place.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.place.dto.response.RecommendedExitResponse;
import com.pingo.backend.place.service.RecommendedExitService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/places")
@RequiredArgsConstructor
public class RecommendedExitController {

    private final RecommendedExitService recommendedExitService;

    @GetMapping("/{placeId}/recommended-exits")
    public ApiResponse<List<RecommendedExitResponse>> getRecommendedExits(@PathVariable Long placeId) {
        return ApiResponse.success(recommendedExitService.getRecommendedExits(placeId));
    }
}
