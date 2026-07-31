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
import java.util.Objects;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FloorMapService {

    private static final String MAP_SUB_DIRECTORY = "maps";
    private static final Set<String> SUPPORTED_MAP_TYPES = Set.of("image", "svg");
    /** 좌표 프레임을 이루는 필드 수: scaleMPerPx · originPxX · originPxY · frameAngleDeg */
    private static final int FRAME_FIELD_COUNT = 4;

    private final FloorMapRepository floorMapRepository;
    private final StationFloorRepository stationFloorRepository;
    private final StationRepository stationRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public FloorMapIdResponse uploadMap(Long floorId, FloorMapUploadRequest request, MultipartFile mapFile) {
        getFloor(floorId);
        String mapType = normalizeMapType(request.mapType());

        List<FloorMap> existingMaps = floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(floorId);
        boolean hasFile = mapFile != null && !mapFile.isEmpty();
        validateMapContent(request, hasFile);
        validateCoordinateFrame(request, existingMaps);

        String mapUrl = hasFile ? fileStorageService.store(mapFile, MAP_SUB_DIRECTORY) : null;
        existingMaps.forEach(FloorMap::deactivate);

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

    /**
     * 등록할 내용이 있는지 검증한다.
     *
     * <p>도면 파일은 선택 사항이다. {@code map_url} 이 nullable 이라(S15P11A206-313) 백엔드가
     * 좌표 프레임만 내려주고 이미지는 클라이언트 자산을 쓰는 구성이 가능하기 때문이다.
     * 역삼역 B1·B2·B3 세 행이 그렇게 들어가 있다.
     *
     * <p>다만 파일도 프레임도 없으면 아무 의미 없는 빈 행이 생기고, 기존 활성 지도만 비활성화된다.
     * 둘 중 하나는 있어야 한다.
     */
    private void validateMapContent(FloorMapUploadRequest request, boolean hasFile) {
        if (!hasFile && countProvidedFrameFields(request) == 0) {
            throw new BusinessException(ErrorCode.EMPTY_FLOOR_MAP);
        }
    }

    /**
     * 업로드 요청의 좌표 프레임을 검증한다.
     *
     * <p>새 지도가 활성화되면 기존 지도는 비활성화되므로, 요청에 프레임이 없으면 그대로
     * 프레임이 사라진다. 그러면 좌표 오버레이가 조용히 멈춘다. 두 가지를 막는다.
     *
     * <ol>
     *     <li><b>부분 입력</b> — 넷 중 일부만 보내면 프레임이 성립하지 않는데 오류 없이 저장된다.
     *         넷 다 있거나 넷 다 없어야 한다.</li>
     *     <li><b>유실</b> — 기존 활성 지도에 프레임이 있는데 요청에 없으면 거부한다.</li>
     * </ol>
     *
     * <p>기존 값을 자동으로 물려주지 않는 이유는 <b>프레임이 특정 이미지에 대한 값</b>이기 때문이다.
     * 원점 픽셀은 그 이미지의 픽셀 위치이고, 새 이미지는 크기·여백·회전이 다르다.
     * 물려주면 오버레이가 켜진 채로 틀린 위치에 그려져 아무도 알아채지 못한다.
     * 프레임이 없어 오버레이가 꺼지는 편이 낫고, 그보다 나은 것은 관리자가 새 이미지 기준으로
     * 다시 재서 함께 올리는 것이다.
     */
    private void validateCoordinateFrame(FloorMapUploadRequest request, List<FloorMap> existingMaps) {
        int provided = countProvidedFrameFields(request);
        if (provided != 0 && provided != FRAME_FIELD_COUNT) {
            throw new BusinessException(ErrorCode.INCOMPLETE_COORDINATE_FRAME);
        }

        if (provided == 0 && existingMaps.stream().anyMatch(FloorMap::hasCoordinateFrame)) {
            throw new BusinessException(ErrorCode.COORDINATE_FRAME_WOULD_BE_LOST);
        }
    }

    private int countProvidedFrameFields(FloorMapUploadRequest request) {
        return (int) Stream.of(
                        request.scaleMPerPx(),
                        request.originPxX(),
                        request.originPxY(),
                        request.frameAngleDeg())
                .filter(Objects::nonNull)
                .count();
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
