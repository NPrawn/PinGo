package com.pingo.backend.place.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.place.dto.request.PlaceExitRecommendationCreateRequest;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationIdResponse;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationResponse;
import com.pingo.backend.place.service.AdminPlaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/place-exit-recommendations")
@RequiredArgsConstructor
public class AdminPlaceExitRecommendationController {

    private final AdminPlaceService adminPlaceService;

    @PostMapping
    public ResponseEntity<ApiResponse<PlaceExitRecommendationIdResponse>> createRecommendation(
            @Valid @RequestBody PlaceExitRecommendationCreateRequest request
    ) {
        PlaceExitRecommendationIdResponse response = adminPlaceService.createRecommendation(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ApiResponse<List<PlaceExitRecommendationResponse>> getRecommendations(
            @RequestParam Long placeId
    ) {
        return ApiResponse.success(adminPlaceService.getRecommendations(placeId));
    }

    @DeleteMapping("/{recommendationId}")
    public ApiResponse<Void> deleteRecommendation(@PathVariable Long recommendationId) {
        adminPlaceService.deleteRecommendation(recommendationId);
        return ApiResponse.success();
    }
}
