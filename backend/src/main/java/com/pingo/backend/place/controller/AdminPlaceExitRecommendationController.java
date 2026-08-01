package com.pingo.backend.place.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.place.dto.request.PlaceExitRecommendationCreateRequest;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationIdResponse;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationResponse;
import com.pingo.backend.place.service.AdminPlaceService;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "관리자 - 장소-출구 추천 관리 API", description = "관리자가 주변 장소와 추천 출구의 연결을 등록·조회·삭제하는 API")
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
            @RequestParam(required = false) Long placeId
    ) {
        return ApiResponse.success(adminPlaceService.getRecommendations(placeId));
    }

    @DeleteMapping("/{recommendationId}")
    public ApiResponse<Void> deleteRecommendation(@PathVariable Long recommendationId) {
        adminPlaceService.deleteRecommendation(recommendationId);
        return ApiResponse.success();
    }
}
