package com.pingo.backend.destination.service;

import com.pingo.backend.destination.dto.request.NearestExitRequest;
import com.pingo.backend.destination.dto.response.NearestExitResponse;
import com.pingo.backend.facility.domain.ExitDetail;
import com.pingo.backend.facility.repository.ExitDetailRepository;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.geo.GeoDistanceCalculator;
import com.pingo.backend.station.repository.StationRepository;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NearestExitService {

    private static final String EXIT_TYPE = "exit";

    private final StationRepository stationRepository;
    private final FacilityRepository facilityRepository;
    private final ExitDetailRepository exitDetailRepository;

    public NearestExitResponse findNearestExit(NearestExitRequest request) {
        validateStation(request.stationId());

        List<Long> exitFacilityIds = facilityRepository.searchActive(request.stationId(), null, EXIT_TYPE).stream()
                .map(facility -> facility.getId())
                .toList();

        return exitDetailRepository.findAllByFacilityIdIn(exitFacilityIds).stream()
                .filter(this::hasOutsideLocation)
                .map(exitDetail -> new ExitCandidate(
                        exitDetail.getFacilityId(),
                        exitDetail.getExitNumber(),
                        distanceFromDestination(exitDetail, request)
                ))
                .min(Comparator.comparingLong(ExitCandidate::distanceMeters)
                        .thenComparing(ExitCandidate::exitFacilityId))
                .map(candidate -> new NearestExitResponse(candidate.exitFacilityId(), candidate.exitNumber()))
                .orElseThrow(() -> new BusinessException(ErrorCode.EXIT_LOCATION_NOT_FOUND));
    }

    private long distanceFromDestination(ExitDetail exitDetail, NearestExitRequest request) {
        return GeoDistanceCalculator.distanceMeters(
                exitDetail.getOutsideLatitude(),
                exitDetail.getOutsideLongitude(),
                request.destinationLatitude(),
                request.destinationLongitude()
        );
    }

    private boolean hasOutsideLocation(ExitDetail exitDetail) {
        return exitDetail.getOutsideLatitude() != null && exitDetail.getOutsideLongitude() != null;
    }

    private void validateStation(Long stationId) {
        if (stationRepository.findByIdAndActiveTrue(stationId).isEmpty()) {
            throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
        }
    }

    private record ExitCandidate(
            Long exitFacilityId,
            String exitNumber,
            long distanceMeters
    ) {
    }
}
