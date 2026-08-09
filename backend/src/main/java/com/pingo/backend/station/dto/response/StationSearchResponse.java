package com.pingo.backend.station.dto.response;

import com.pingo.backend.externalmap.client.KakaoPlaceSearchResult;
import com.pingo.backend.station.domain.Station;

import java.math.BigDecimal;

/**
 * 역 검색 결과 한 건.
 *
 * 등록된 역(provider=pingo)과 외부 지하철역 검색 결과(provider=kakao)를 같은 모양으로 내려준다.
 * 외부 결과는 stationId 가 없어 실내 안내를 붙일 수 없으므로 serviceReady=false 로 구분한다.
 */
public record StationSearchResponse(
        Long stationId,
        String nameKo,
        String nameEn,
        String lineInfo,
        String provider,
        String externalId,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        boolean serviceReady
) {

    private static final String PROVIDER_PINGO = "pingo";
    private static final String PROVIDER_KAKAO = "kakao";

    /** 좌표가 필요 없는 호출부(등록된 역 목록)용 축약 생성자. */
    public StationSearchResponse(Long stationId, String nameKo, String nameEn, String lineInfo) {
        this(stationId, nameKo, nameEn, lineInfo, PROVIDER_PINGO, null, null, null, null, true);
    }

    public static StationSearchResponse from(Station station) {
        return new StationSearchResponse(
                station.getId(),
                station.getNameKo(),
                station.getNameEn(),
                station.getLineInfo(),
                PROVIDER_PINGO,
                null,
                null,
                station.getLatitude(),
                station.getLongitude(),
                true
        );
    }

    /**
     * 카카오 지하철역 검색 결과를 역 하나로 변환한다.
     *
     * 카카오는 환승역을 노선별로 따로 내려주므로 노선 정보는 호출부에서 합쳐 넘긴다.
     */
    public static StationSearchResponse fromKakaoStation(
            String nameKo,
            String lineInfo,
            KakaoPlaceSearchResult place
    ) {
        return new StationSearchResponse(
                null,
                nameKo,
                null,
                lineInfo,
                PROVIDER_KAKAO,
                place.placeId(),
                place.address(),
                place.latitude(),
                place.longitude(),
                false
        );
    }
}
