package com.pingo.backend.externalmap.client;

import java.math.BigDecimal;
import java.util.List;

public interface KakaoLocalClient {

    List<KakaoPlaceSearchResult> searchPlaces(
            String keyword,
            BigDecimal centerLongitude,
            BigDecimal centerLatitude
    );
}
