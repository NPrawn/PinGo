package com.pingo.backend.externalmap.client;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
@Slf4j
public class RestClientKakaoLocalClient implements KakaoLocalClient {

    private static final int SEARCH_RADIUS_METERS = 3_000;
    private static final int SEARCH_RESULT_SIZE = 15;
    /** 카카오 로컬 카테고리 그룹 코드: 지하철역. */
    private static final String SUBWAY_CATEGORY_GROUP_CODE = "SW8";

    private final RestClient restClient;
    private final KakaoLocalProperties properties;
    private final AtomicBoolean missingApiKeyWarningLogged = new AtomicBoolean();

    public RestClientKakaoLocalClient(
            @Qualifier("kakaoLocalRestClient") RestClient restClient,
            KakaoLocalProperties properties
    ) {
        this.restClient = restClient;
        this.properties = properties;
    }

    @Override
    public List<KakaoPlaceSearchResult> searchPlaces(
            String keyword,
            BigDecimal centerLongitude,
            BigDecimal centerLatitude
    ) {
        if (isApiKeyMissing()) {
            logMissingApiKeyOnce();
            return List.of();
        }

        try {
            KakaoLocalSearchResponse response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v2/local/search/keyword.json")
                            .queryParam("query", keyword)
                            .queryParam("x", centerLongitude.toPlainString())
                            .queryParam("y", centerLatitude.toPlainString())
                            .queryParam("radius", SEARCH_RADIUS_METERS)
                            .queryParam("sort", "distance")
                            .queryParam("size", SEARCH_RESULT_SIZE)
                            .build())
                    .header(HttpHeaders.AUTHORIZATION, "KakaoAK " + properties.restApiKey())
                    .retrieve()
                    .body(KakaoLocalSearchResponse.class);

            if (response == null || response.documents() == null) {
                return List.of();
            }

            return response.documents().stream()
                    .map(this::toSearchResult)
                    .toList();
        } catch (RestClientException | NumberFormatException exception) {
            throw new BusinessException(ErrorCode.EXTERNAL_PLACE_SEARCH_FAILED);
        }
    }

    @Override
    public List<KakaoPlaceSearchResult> searchSubwayStations(String keyword) {
        if (isApiKeyMissing()) {
            logMissingApiKeyOnce();
            return List.of();
        }

        try {
            KakaoLocalSearchResponse response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v2/local/search/keyword.json")
                            .queryParam("query", keyword)
                            .queryParam("category_group_code", SUBWAY_CATEGORY_GROUP_CODE)
                            .queryParam("size", SEARCH_RESULT_SIZE)
                            .build())
                    .header(HttpHeaders.AUTHORIZATION, "KakaoAK " + properties.restApiKey())
                    .retrieve()
                    .body(KakaoLocalSearchResponse.class);

            if (response == null || response.documents() == null) {
                return List.of();
            }

            return response.documents().stream()
                    .map(this::toSearchResult)
                    .toList();
        } catch (RestClientException | NumberFormatException exception) {
            throw new BusinessException(ErrorCode.EXTERNAL_PLACE_SEARCH_FAILED);
        }
    }

    @Override
    public List<KakaoPlaceSearchResult> searchNearbySubwayStations(
            BigDecimal centerLongitude,
            BigDecimal centerLatitude
    ) {
        if (isApiKeyMissing()) {
            logMissingApiKeyOnce();
            return List.of();
        }

        try {
            KakaoLocalSearchResponse response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v2/local/search/category.json")
                            .queryParam("category_group_code", SUBWAY_CATEGORY_GROUP_CODE)
                            .queryParam("x", centerLongitude.toPlainString())
                            .queryParam("y", centerLatitude.toPlainString())
                            .queryParam("radius", SEARCH_RADIUS_METERS)
                            .queryParam("sort", "distance")
                            .queryParam("size", SEARCH_RESULT_SIZE)
                            .build())
                    .header(HttpHeaders.AUTHORIZATION, "KakaoAK " + properties.restApiKey())
                    .retrieve()
                    .body(KakaoLocalSearchResponse.class);

            if (response == null || response.documents() == null) {
                return List.of();
            }

            return response.documents().stream()
                    .map(this::toSearchResult)
                    .toList();
        } catch (RestClientException | NumberFormatException exception) {
            throw new BusinessException(ErrorCode.EXTERNAL_PLACE_SEARCH_FAILED);
        }
    }

    @Override
    public KakaoWalkingRouteResult findWalkingRoute(
            BigDecimal startLongitude,
            BigDecimal startLatitude,
            BigDecimal endLongitude,
            BigDecimal endLatitude
    ) {
        if (isApiKeyMissing()) {
            logMissingApiKeyOnce();
            throw new BusinessException(ErrorCode.EXTERNAL_WALKING_ROUTE_FAILED);
        }

        try {
            KakaoWalkingRouteResponse response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/v2/routing/walk")
                            .queryParam("start_x", startLongitude.toPlainString())
                            .queryParam("start_y", startLatitude.toPlainString())
                            .queryParam("end_x", endLongitude.toPlainString())
                            .queryParam("end_y", endLatitude.toPlainString())
                            .queryParam("input_coord", "WGS84")
                            .queryParam("output_coord", "WGS84")
                            .build())
                    .header(HttpHeaders.AUTHORIZATION, "KakaoAK " + properties.restApiKey())
                    .retrieve()
                    .body(KakaoWalkingRouteResponse.class);

            if (response == null || response.route() == null || response.route().properties() == null) {
                throw new BusinessException(ErrorCode.EXTERNAL_WALKING_ROUTE_FAILED);
            }

            KakaoWalkingRouteProperties route = response.route().properties();
            return new KakaoWalkingRouteResult(route.totalDistance(), route.totalTime(), response.landingUrl());
        } catch (RestClientException exception) {
            throw new BusinessException(ErrorCode.EXTERNAL_WALKING_ROUTE_FAILED);
        }
    }

    private KakaoPlaceSearchResult toSearchResult(KakaoPlaceDocument document) {
        return new KakaoPlaceSearchResult(
                document.id(),
                document.place_name(),
                document.category_name(),
                firstNonBlank(document.road_address_name(), document.address_name()),
                new BigDecimal(document.y()),
                new BigDecimal(document.x()),
                parseDistance(document.distance())
        );
    }

    private Long parseDistance(String distance) {
        if (distance == null || distance.isBlank()) {
            return null;
        }
        return Long.parseLong(distance);
    }

    private String firstNonBlank(String primary, String fallback) {
        return primary == null || primary.isBlank() ? fallback : primary;
    }

    private boolean isApiKeyMissing() {
        return properties.restApiKey() == null || properties.restApiKey().isBlank();
    }

    private void logMissingApiKeyOnce() {
        if (missingApiKeyWarningLogged.compareAndSet(false, true)) {
            log.warn("KAKAO_REST_API_KEY가 설정되지 않아 카카오 외부 장소 검색을 건너뜁니다.");
        }
    }

    private record KakaoLocalSearchResponse(
            List<KakaoPlaceDocument> documents
    ) {
    }

    private record KakaoPlaceDocument(
            String id,
            String place_name,
            String category_name,
            String address_name,
            String road_address_name,
            String x,
            String y,
            String distance
    ) {
    }

    private record KakaoWalkingRouteResponse(
            KakaoWalkingRoute route,
            String landingUrl
    ) {
    }

    private record KakaoWalkingRoute(
            KakaoWalkingRouteProperties properties
    ) {
    }

    private record KakaoWalkingRouteProperties(
            long totalDistance,
            long totalTime
    ) {
    }
}
