package com.pingo.backend.localization.service;

import com.pingo.backend.localization.anchoring.AnchoredLocation;
import com.pingo.backend.localization.anchoring.CanonicalDirection;
import com.pingo.backend.localization.anchoring.ColmapToCanonicalMapper;
import com.pingo.backend.localization.anchoring.IndoorPositionResolver;
import com.pingo.backend.localization.client.AiLocalizationClient;
import com.pingo.backend.localization.client.AiLocalizationClientErrorType;
import com.pingo.backend.localization.client.AiLocalizationClientException;
import com.pingo.backend.localization.client.AiLocalizationProperties;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import com.pingo.backend.localization.dto.response.LocalizationResponse;
import com.pingo.backend.localization.dto.response.LocalizationCandidateResponse;
import com.pingo.backend.localization.dto.response.LocalizedPositionResponse;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import com.pingo.backend.localization.dto.response.PlanarDirectionResponse;
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
    private final ColmapToCanonicalMapper canonicalMapper;
    private final IndoorPositionResolver positionResolver;
    private final AiLocalizationProperties aiLocalizationProperties;

    public LocalizationService(
            AiLocalizationClient aiLocalizationClient,
            AiLocalizationStatusMapper statusMapper,
            LocalizationFallbackPolicy fallbackPolicy,
            AiLocalizationRequestMapper requestMapper,
            ColmapToCanonicalMapper canonicalMapper,
            IndoorPositionResolver positionResolver,
            AiLocalizationProperties aiLocalizationProperties
    ) {
        this.aiLocalizationClient = aiLocalizationClient;
        this.statusMapper = statusMapper;
        this.fallbackPolicy = fallbackPolicy;
        this.requestMapper = requestMapper;
        this.canonicalMapper = canonicalMapper;
        this.positionResolver = positionResolver;
        this.aiLocalizationProperties = aiLocalizationProperties;
    }

    public LocalizationResponse localize(
            String requestId,
            MultipartFile image,
            LocalizationRequestMetadata metadata
    ) {
        String mapVersion = aiLocalizationProperties.mapSetVersionFor(metadata.stationId());
        if (mapVersion == null) {
            return responseFor(requestId, null, null, LocalizationResultStatus.MAP_NOT_READY);
        }

        try {
            AiLocalizationResponse aiResponse = aiLocalizationClient.localize(
                    requestId,
                    mapVersion,
                    image,
                    requestMapper.toAiMetadata(metadata)
            );
            if (aiResponse == null || aiResponse.status() == null) {
                return responseFor(
                        requestId,
                        mapVersion,
                        processingTimeMs(aiResponse),
                        LocalizationResultStatus.INTERNAL_ERROR
                );
            }

            LocalizationResultStatus resultStatus = statusMapper.map(
                    aiResponse.status().name(),
                    aiResponse.failureReason()
            );

            Optional<AnchoredLocation> resolved = anchor(resultStatus, aiResponse, metadata);
            Optional<AnchoredLocation> anchored = resultStatus == LocalizationResultStatus.SUCCESS
                    ? resolved
                    : Optional.empty();
            LocalizationCandidateResponse candidate = resultStatus == LocalizationResultStatus.LOW_CONFIDENCE
                    ? toCandidate(resolved, aiResponse)
                    : null;
            LocalizationResultStatus finalStatus = withAnchoringOutcome(resultStatus, anchored);
            return new LocalizationResponse(
                    requestId,
                    finalStatus,
                    responseMapVersion(aiResponse, mapVersion),
                    anchored.map(LocalizationService::toPosition).orElse(null),
                    anchored.map(AnchoredLocation::startNodeId).orElse(null),
                    anchored.map(AnchoredLocation::startNodeLabel).orElse(null),
                    candidate,
                    fallbackPolicy.optionsFor(finalStatus),
                    processingTimeMs(aiResponse)
            );
        } catch (AiLocalizationClientException e) {
            return responseFor(
                    requestId,
                    mapVersion,
                    null,
                    mapClientError(e.getErrorType())
            );
        }
    }

    /**
     * AI 가 돌려준 COLMAP pose 를 캐노니컬 좌표로 옮기고 경로 진입 노드를 찾는다.
     *
     * <p>다음 경우에는 비어 있다.
     * <ul>
     *     <li>위치 인식이 성공하지 않은 경우</li>
     *     <li>AI 가 pose 나 카메라 중심을 주지 않은 경우</li>
     *     <li><b>해당 역·층의 좌표 정합이 없는 경우</b> — 역삼역 B1 은 COLMAP 커버가 없어 여기 해당한다</li>
     *     <li>층이나 노드를 찾지 못한 경우</li>
     * </ul>
     *
     * <p>{@code LOW_CONFIDENCE}도 최소 후보 품질을 통과해 pose가 있으면 같은 방식으로 앵커링한다.
     * 이 결과는 확정 위치가 아니라 여러 프레임 투표용 {@code candidate}에만 담긴다.
     *
     * <p><b>방향은 실패해도 앵커링을 막지 않는다.</b> 방향이 없으면 FE 가 WebXR 정렬만 못 하고
     * 지도에 위치를 찍는 것은 그대로 된다. 좌표까지 버리면 잃는 게 더 크다.
     */
    private Optional<AnchoredLocation> anchor(
            LocalizationResultStatus resultStatus,
            AiLocalizationResponse aiResponse,
            LocalizationRequestMetadata metadata
    ) {
        if ((resultStatus != LocalizationResultStatus.SUCCESS
                && resultStatus != LocalizationResultStatus.LOW_CONFIDENCE)
                || aiResponse.pose() == null) {
            return Optional.empty();
        }

        Long stationId = metadata.stationId();
        String floorCode = aiResponse.floor();
        CanonicalDirection forward = canonicalMapper
                .toCanonicalDirection(stationId, floorCode, aiResponse.pose().rotationXyzw())
                .orElse(null);

        return canonicalMapper.toCanonical(stationId, floorCode, aiResponse.pose().cameraCenter())
                .flatMap(point -> positionResolver.resolve(
                        stationId,
                        floorCode,
                        point,
                        forward,
                        canonicalMapper.accuracyOf(stationId, floorCode).orElseThrow()));
    }

    /**
     * 위치 인식은 성공했지만 앵커링이 안 된 경우의 상태.
     *
     * <p>그대로 {@code SUCCESS} 로 두면 좌표도 경로 진입점도 없는데
     * {@code fallbackOptions} 까지 비어서 클라이언트가 갈 화면이 없어진다. 실제로 역삼역 B1 은
     * COLMAP 커버가 없어 AI 가 성공해도 항상 이 상태가 된다.
     *
     * <p>{@code MAP_NOT_READY} 로 내린다. 뜻이 "해당 역 또는 층의 VPS 맵이 준비되지 않음"이고
     * 사용자가 겪는 상황도 같다 — 지도 위에 자기 위치를 찍을 수 없다. 대체 수단은
     * {@link LocalizationFallbackPolicy} 가 안내한다.
     */
    private LocalizationResultStatus withAnchoringOutcome(
            LocalizationResultStatus resultStatus,
            Optional<AnchoredLocation> anchored
    ) {
        if (resultStatus == LocalizationResultStatus.SUCCESS && anchored.isEmpty()) {
            return LocalizationResultStatus.MAP_NOT_READY;
        }
        return resultStatus;
    }

    private static LocalizedPositionResponse toPosition(AnchoredLocation anchored) {
        return new LocalizedPositionResponse(
                anchored.floorId(),
                anchored.floorCode(),
                anchored.mapX(),
                anchored.mapY(),
                anchored.mapZ(),
                toForwardMap(anchored),
                anchored.accuracyM()
        );
    }

    private static LocalizationCandidateResponse toCandidate(
            Optional<AnchoredLocation> anchored,
            AiLocalizationResponse aiResponse
    ) {
        if (anchored.isEmpty() || aiResponse.quality() == null) {
            return null;
        }
        Double score = aiResponse.quality().confidenceScore();
        if (score == null || !Double.isFinite(score) || score <= 0.0 || score > 1.0) {
            return null;
        }
        AnchoredLocation value = anchored.orElseThrow();
        return new LocalizationCandidateResponse(
                toPosition(value),
                value.startNodeId(),
                value.startNodeLabel(),
                score
        );
    }

    /**
     * 방향 두 성분을 응답 객체로 묶는다. 산출하지 못했으면 {@code null} 이다.
     *
     * <p>성분 하나만 있는 경우는 없지만 둘 다 확인한다. 한쪽만 채워진 벡터가 나가면 FE 가
     * 0 으로 읽어 90도 틀어진 방향으로 정렬하는데, 그래도 오류가 나지 않는다.
     */
    private static PlanarDirectionResponse toForwardMap(AnchoredLocation anchored) {
        if (anchored.forwardMapX() == null || anchored.forwardMapY() == null) {
            return null;
        }
        return new PlanarDirectionResponse(anchored.forwardMapX(), anchored.forwardMapY());
    }

    private LocalizationResponse responseFor(
            String requestId,
            String mapVersion,
            Integer processingTimeMs,
            LocalizationResultStatus resultStatus
    ) {
        return new LocalizationResponse(
                requestId,
                resultStatus,
                mapVersion,
                null,
                null,
                null,
                null,
                fallbackPolicy.optionsFor(resultStatus),
                processingTimeMs
        );
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

    private String responseMapVersion(AiLocalizationResponse aiResponse, String requestedMapVersion) {
        if (aiResponse.mapVersion() == null || aiResponse.mapVersion().isBlank()) {
            return requestedMapVersion;
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
