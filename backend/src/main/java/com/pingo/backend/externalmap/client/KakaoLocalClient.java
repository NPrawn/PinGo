package com.pingo.backend.externalmap.client;

import java.math.BigDecimal;
import java.util.List;

public interface KakaoLocalClient {

    List<KakaoPlaceSearchResult> searchPlaces(
            String keyword,
            BigDecimal centerLongitude,
            BigDecimal centerLatitude
    );

    /**
     * 지하철역만 검색한다. 역 이름은 전국에서 찾아야 하므로 중심 좌표·반경을 걸지 않고
     * 카테고리(지하철역)로만 좁힌다.
     */
    List<KakaoPlaceSearchResult> searchSubwayStations(String keyword);

    /** 중심 좌표 반경 안의 지하철역을 거리순으로 검색한다. */
    List<KakaoPlaceSearchResult> searchNearbySubwayStations(
            BigDecimal centerLongitude,
            BigDecimal centerLatitude
    );

    KakaoWalkingRouteResult findWalkingRoute(
            BigDecimal startLongitude,
            BigDecimal startLatitude,
            BigDecimal endLongitude,
            BigDecimal endLatitude
    );
}
