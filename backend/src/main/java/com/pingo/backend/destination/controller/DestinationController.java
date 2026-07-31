package com.pingo.backend.destination.controller;

import com.pingo.backend.destination.dto.request.NearestExitRequest;
import com.pingo.backend.destination.dto.response.NearestExitResponse;
import com.pingo.backend.destination.dto.response.DestinationSearchResponse;
import com.pingo.backend.destination.service.DestinationService;
import com.pingo.backend.destination.service.NearestExitService;
import com.pingo.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/destinations")
@RequiredArgsConstructor
public class DestinationController {

    private final DestinationService destinationService;
    private final NearestExitService nearestExitService;

    @GetMapping("/search")
    public ApiResponse<List<DestinationSearchResponse>> search(
            @RequestParam(required = false) Long stationId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String language
    ) {
        return ApiResponse.success(destinationService.search(stationId, keyword));
    }

    @PostMapping("/nearest-exit")
    public ApiResponse<NearestExitResponse> findNearestExit(
            @Valid @RequestBody NearestExitRequest request
    ) {
        return ApiResponse.success(nearestExitService.findNearestExit(request));
    }
}
