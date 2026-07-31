package com.pingo.backend.floormap.controller;

import com.pingo.backend.floormap.dto.request.FloorMapUploadRequest;
import com.pingo.backend.floormap.dto.response.FloorMapIdResponse;
import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.service.FloorMapService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/floors")
@RequiredArgsConstructor
@Tag(name = "관리자 - 층별 지도 관리 API", description = "관리자가 층별 도면과 좌표 프레임을 업로드·조회하는 API")
public class AdminFloorMapController {

    private final FloorMapService floorMapService;

    @PostMapping("/{floorId}/maps")
    public ResponseEntity<ApiResponse<FloorMapIdResponse>> uploadMap(
            @PathVariable Long floorId,
            @Valid @ModelAttribute FloorMapUploadRequest request,
            @RequestParam(value = "mapFile", required = false) MultipartFile mapFile
    ) {
        FloorMapIdResponse response = floorMapService.uploadMap(floorId, request, mapFile);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping("/{floorId}/maps")
    public ApiResponse<List<FloorMapResponse>> getMaps(@PathVariable Long floorId) {
        return ApiResponse.success(floorMapService.getMaps(floorId));
    }
}
