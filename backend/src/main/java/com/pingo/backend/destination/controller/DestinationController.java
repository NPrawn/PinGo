package com.pingo.backend.destination.controller;

import com.pingo.backend.destination.dto.response.DestinationSearchResponse;
import com.pingo.backend.destination.service.DestinationService;
import com.pingo.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/destinations")
@RequiredArgsConstructor
public class DestinationController {

    private final DestinationService destinationService;

    @GetMapping("/search")
    public ApiResponse<List<DestinationSearchResponse>> search(
            @RequestParam(required = false) Long stationId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String language
    ) {
        return ApiResponse.success(destinationService.search(stationId, keyword));
    }
}
