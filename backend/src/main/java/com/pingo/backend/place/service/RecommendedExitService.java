package com.pingo.backend.place.service;

import com.pingo.backend.facility.domain.ExitDetail;
import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.repository.ExitDetailRepository;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.place.domain.PlaceExitRecommendation;
import com.pingo.backend.place.dto.response.RecommendedExitResponse;
import com.pingo.backend.place.repository.NearbyPlaceRepository;
import com.pingo.backend.place.repository.PlaceExitRecommendationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecommendedExitService {

    private final PlaceExitRecommendationRepository recommendationRepository;
    private final NearbyPlaceRepository nearbyPlaceRepository;
    private final FacilityRepository facilityRepository;
    private final ExitDetailRepository exitDetailRepository;

    /**
     * 주변 장소와 연결된 추천 출구를 우선순위(priority) 순으로 반환한다.
     * 추천 출구 시설이 비활성/삭제된 경우 결과에서 제외한다.
     */
    public List<RecommendedExitResponse> getRecommendedExits(Long placeId) {
        if (nearbyPlaceRepository.findByIdAndActiveTrue(placeId).isEmpty()) {
            throw new BusinessException(ErrorCode.PLACE_NOT_FOUND);
        }

        List<RecommendedExitResponse> results = new ArrayList<>();
        for (PlaceExitRecommendation recommendation : recommendationRepository.findAllByPlaceIdOrderByPriorityAscIdAsc(placeId)) {
            facilityRepository.findByIdAndActiveTrue(recommendation.getExitFacilityId())
                    .map(exitFacility -> toResponse(recommendation, exitFacility))
                    .ifPresent(results::add);
        }
        return results;
    }

    private RecommendedExitResponse toResponse(PlaceExitRecommendation recommendation, Facility exitFacility) {
        RecommendedExitResponse.ExitLocation exitLocation = exitDetailRepository.findByFacilityId(exitFacility.getId())
                .map(RecommendedExitService::toExitLocation)
                .orElse(null);

        return new RecommendedExitResponse(
                recommendation.getId(),
                recommendation.getPlaceId(),
                exitFacility.getId(),
                exitFacility.getNameKo(),
                exitFacility.getNameEn(),
                recommendation.getPriority(),
                recommendation.isPrimary(),
                recommendation.getReasonKo(),
                recommendation.getReasonEn(),
                recommendation.getWalkingTimeMin(),
                exitLocation
        );
    }

    private static RecommendedExitResponse.ExitLocation toExitLocation(ExitDetail exitDetail) {
        if (exitDetail.getOutsideLatitude() == null && exitDetail.getOutsideLongitude() == null) {
            return null;
        }
        return new RecommendedExitResponse.ExitLocation(
                exitDetail.getOutsideLatitude(),
                exitDetail.getOutsideLongitude()
        );
    }
}
