package com.pingo.backend.floormap.service;

import com.pingo.backend.floormap.domain.FloorMap;
import com.pingo.backend.floormap.dto.request.FloorMapUploadRequest;
import com.pingo.backend.floormap.dto.response.FloorMapIdResponse;
import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.repository.FloorMapRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FloorMapService {

    private static final String MAP_SUB_DIRECTORY = "maps";
    private static final Set<String> SUPPORTED_MAP_TYPES = Set.of("image", "svg");

    private final FloorMapRepository floorMapRepository;
    private final StationFloorRepository stationFloorRepository;
    private final StationRepository stationRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public FloorMapIdResponse uploadMap(Long floorId, FloorMapUploadRequest request, MultipartFile mapFile) {
        getFloor(floorId);
        String mapType = normalizeMapType(request.mapType());

        String mapUrl = fileStorageService.store(mapFile, MAP_SUB_DIRECTORY);
        deactivateExistingMaps(floorId);

        FloorMap floorMap = FloorMap.create(
                floorId,
                mapType,
                mapUrl,
                request.width(),
                request.height(),
                request.scaleMPerPx(),
                request.originPxX(),
                request.originPxY(),
                request.frameAngleDeg(),
                nextVersion(floorId)
        );

        return new FloorMapIdResponse(floorMapRepository.save(floorMap).getId());
    }

    public List<FloorMapResponse> getMaps(Long floorId) {
        StationFloor floor = getFloor(floorId);

        return floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(floorId).stream()
                .map(floorMap -> FloorMapResponse.of(floorMap, floor.getFloorCode()))
                .toList();
    }

    public List<FloorMapResponse> getMapsByStation(Long stationId) {
        if (stationRepository.findByIdAndActiveTrue(stationId).isEmpty()) {
            throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
        }

        List<StationFloor> floors = stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(stationId);
        if (floors.isEmpty()) {
            return List.of();
        }

        Map<Long, StationFloor> floorsById = floors.stream()
                .collect(Collectors.toMap(StationFloor::getId, Function.identity()));
        Map<Long, FloorMap> mapsByFloorId = floorMapRepository.findAllByFloorIdInAndActiveTrue(floorsById.keySet()).stream()
                .collect(Collectors.toMap(FloorMap::getFloorId, Function.identity(), (first, second) -> first));

        // 층 정렬 순서(floorOrder)대로, 활성 지도가 있는 층만 응답한다.
        return floors.stream()
                .filter(floor -> mapsByFloorId.containsKey(floor.getId()))
                .map(floor -> FloorMapResponse.of(mapsByFloorId.get(floor.getId()), floor.getFloorCode()))
                .toList();
    }

    private StationFloor getFloor(Long floorId) {
        StationFloor floor = stationFloorRepository.findById(floorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FLOOR_NOT_FOUND));

        if (!floor.getStation().isActive()) {
            throw new BusinessException(ErrorCode.FLOOR_NOT_FOUND);
        }

        return floor;
    }

    private void deactivateExistingMaps(Long floorId) {
        floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(floorId)
                .forEach(FloorMap::deactivate);
    }

    private String nextVersion(Long floorId) {
        return "v" + (floorMapRepository.countByFloorId(floorId) + 1);
    }

    private String normalizeMapType(String mapType) {
        String normalized = mapType.trim().toLowerCase(Locale.ROOT);
        if (!SUPPORTED_MAP_TYPES.contains(normalized)) {
            throw new BusinessException(ErrorCode.UNSUPPORTED_MAP_TYPE);
        }
        return normalized;
    }
}
