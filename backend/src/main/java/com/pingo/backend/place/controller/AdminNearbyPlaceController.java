package com.pingo.backend.place.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.place.dto.request.NearbyPlaceCreateRequest;
import com.pingo.backend.place.dto.request.NearbyPlaceUpdateRequest;
import com.pingo.backend.place.dto.response.NearbyPlaceIdResponse;
import com.pingo.backend.place.dto.response.NearbyPlaceResponse;
import com.pingo.backend.place.service.AdminPlaceService;
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
@RequestMapping("/api/admin/nearby-places")
@RequiredArgsConstructor
@Tag(name = "관리자 - 주변 장소 관리 API", description = "관리자가 역 주변 장소를 등록·조회·수정·삭제하는 API")
public class AdminNearbyPlaceController {

    private final AdminPlaceService adminPlaceService;

    @PostMapping
    public ResponseEntity<ApiResponse<NearbyPlaceIdResponse>> createPlace(
            @Valid @RequestBody NearbyPlaceCreateRequest request
    ) {
        NearbyPlaceIdResponse response = adminPlaceService.createPlace(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ApiResponse<List<NearbyPlaceResponse>> getPlaces(
            @RequestParam(required = false) Long stationId
    ) {
        return ApiResponse.success(adminPlaceService.getPlaces(stationId));
    }

    @GetMapping("/{placeId}")
    public ApiResponse<NearbyPlaceResponse> getPlace(@PathVariable Long placeId) {
        return ApiResponse.success(adminPlaceService.getPlace(placeId));
    }

    @PatchMapping("/{placeId}")
    public ApiResponse<NearbyPlaceResponse> updatePlace(
            @PathVariable Long placeId,
            @Valid @RequestBody NearbyPlaceUpdateRequest request
    ) {
        return ApiResponse.success(adminPlaceService.updatePlace(placeId, request));
    }

    @DeleteMapping("/{placeId}")
    public ApiResponse<Void> deletePlace(@PathVariable Long placeId) {
        adminPlaceService.deletePlace(placeId);
        return ApiResponse.success();
    }
}
