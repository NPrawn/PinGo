package com.pingo.backend.localization.service;

import com.pingo.backend.localization.client.AiLocalizationClient;
import com.pingo.backend.localization.client.AiLocalizationClientErrorType;
import com.pingo.backend.localization.client.AiLocalizationClientException;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import com.pingo.backend.localization.dto.response.LocalizationCandidateResponse;
import com.pingo.backend.localization.dto.response.LocalizationResponse;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LocalizationService {

    private final AiLocalizationClient aiLocalizationClient;
    private final AiLocalizationStatusMapper statusMapper;
    private final LocalizationFallbackPolicy fallbackPolicy;
    private final AiLocalizationRequestMapper requestMapper;
    private final StationFloorRepository stationFloorRepository;
    private final RouteNodeRepository routeNodeRepository;

    public LocalizationService(
            AiLocalizationClient aiLocalizationClient,
            AiLocalizationStatusMapper statusMapper,
            LocalizationFallbackPolicy fallbackPolicy,
            AiLocalizationRequestMapper requestMapper,
            StationFloorRepository stationFloorRepository,
            RouteNodeRepository routeNodeRepository
    ) {
        this.aiLocalizationClient = aiLocalizationClient;
        this.statusMapper = statusMapper;
        this.fallbackPolicy = fallbackPolicy;
        this.requestMapper = requestMapper;
        this.stationFloorRepository = stationFloorRepository;
        this.routeNodeRepository = routeNodeRepository;
    }

    public LocalizationResponse localize(
            String requestId,
            MultipartFile image,
            LocalizationRequestMetadata metadata
    ) {
        try {
            AiLocalizationResponse aiResponse = aiLocalizationClient.localize(
                    requestId,
                    metadata.mapVersion(),
                    image,
                    requestMapper.toAiMetadata(metadata)
            );
            if (aiResponse == null || aiResponse.status() == null) {
                return responseFor(
                        requestId,
                        metadata.mapVersion(),
                        processingTimeMs(aiResponse),
                        LocalizationResultStatus.INTERNAL_ERROR
                );
            }

            LocalizationResultStatus resultStatus = statusMapper.map(
                    aiResponse.status().name(),
                    aiResponse.failureReason()
            );

            return responseFor(
                    requestId,
                    responseMapVersion(aiResponse, metadata),
                    processingTimeMs(aiResponse),
                    resultStatus,
                    candidatesFor(aiResponse, metadata)
            );
        } catch (AiLocalizationClientException e) {
            return responseFor(
                    requestId,
                    metadata.mapVersion(),
                    null,
                    mapClientError(e.getErrorType())
            );
        }
    }

    private LocalizationResponse responseFor(
            String requestId,
            String mapVersion,
            Integer processingTimeMs,
            LocalizationResultStatus resultStatus
    ) {
        return responseFor(requestId, mapVersion, processingTimeMs, resultStatus, List.of());
    }

    private LocalizationResponse responseFor(
            String requestId,
            String mapVersion,
            Integer processingTimeMs,
            LocalizationResultStatus resultStatus,
            List<LocalizationCandidateResponse> candidates
    ) {
        return new LocalizationResponse(
                requestId,
                resultStatus,
                mapVersion,
                candidates,
                fallbackPolicy.optionsFor(resultStatus),
                processingTimeMs
        );
    }

    private List<LocalizationCandidateResponse> candidatesFor(
            AiLocalizationResponse aiResponse,
            LocalizationRequestMetadata metadata
    ) {
        if (aiResponse.pose() == null || aiResponse.floor() == null) {
            return List.of();
        }
        List<Double> position = aiResponse.pose().cameraCenter();
        if (position == null || position.size() < 3) {
            position = aiResponse.pose().translation();
        }
        if (position == null || position.size() < 3) {
            return List.of();
        }

        Optional<StationFloor> floor = stationFloorRepository
                .findAllByStationIdOrderByFloorOrderAsc(metadata.stationId())
                .stream()
                .filter(value -> value.getFloorCode().equalsIgnoreCase(aiResponse.floor()))
                .findFirst();
        if (floor.isEmpty()) {
            return List.of();
        }

        // AI's world coordinates use X/Z as the floor plane.
        double mapX = position.get(0);
        double mapY = position.get(2);
        Optional<RouteNode> nearestNode = routeNodeRepository.search(metadata.stationId(), floor.get().getId())
                .stream()
                .min((left, right) -> Double.compare(
                        squaredDistance(left, mapX, mapY),
                        squaredDistance(right, mapX, mapY)
                ));
        if (nearestNode.isEmpty()) {
            return List.of();
        }

        RouteNode node = nearestNode.get();
        BigDecimal confidence = confidenceFor(aiResponse);
        return List.of(new LocalizationCandidateResponse(
                node.getId(),
                node.getFloorId(),
                node.getName() == null || node.getName().isBlank() ? floor.get().getFloorCode() : node.getName(),
                BigDecimal.valueOf(mapX),
                BigDecimal.valueOf(mapY),
                confidence,
                confidenceLabel(confidence)
        ));
    }

    private double squaredDistance(RouteNode node, double mapX, double mapY) {
        double dx = node.getMapX().doubleValue() - mapX;
        double dy = node.getMapY().doubleValue() - mapY;
        return dx * dx + dy * dy;
    }

    private BigDecimal confidenceFor(AiLocalizationResponse response) {
        Double inlierRatio = response.quality() == null ? null : response.quality().inlierRatio();
        return inlierRatio == null ? null : BigDecimal.valueOf(inlierRatio);
    }

    private String confidenceLabel(BigDecimal confidence) {
        if (confidence == null) {
            return null;
        }
        if (confidence.compareTo(new BigDecimal("0.7")) >= 0) {
            return "high";
        }
        if (confidence.compareTo(new BigDecimal("0.4")) >= 0) {
            return "medium";
        }
        return "low";
    }

    private Integer processingTimeMs(AiLocalizationResponse aiResponse) {
        if (aiResponse == null) {
            return null;
        }

        if (aiResponse.timingMs() == null) {
            return null;
        }

        return aiResponse.timingMs().total();
    }

    private String responseMapVersion(AiLocalizationResponse aiResponse, LocalizationRequestMetadata metadata) {
        if (aiResponse.mapVersion() == null || aiResponse.mapVersion().isBlank()) {
            return metadata.mapVersion();
        }

        return aiResponse.mapVersion();
    }

    private LocalizationResultStatus mapClientError(AiLocalizationClientErrorType errorType) {
        return switch (errorType) {
            case TIMEOUT -> LocalizationResultStatus.TIMEOUT;
            case UNAVAILABLE -> LocalizationResultStatus.AI_SERVER_UNAVAILABLE;
            case BAD_REQUEST, INTERNAL_ERROR -> LocalizationResultStatus.INTERNAL_ERROR;
        };
    }
}
