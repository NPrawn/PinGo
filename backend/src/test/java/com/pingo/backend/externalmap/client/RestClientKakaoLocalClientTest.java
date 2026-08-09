package com.pingo.backend.externalmap.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RestClientKakaoLocalClientTest {

    @Test
    void findWalkingRouteMapsKakaoRouteMetrics() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClientKakaoLocalClient client = new RestClientKakaoLocalClient(
                builder.build(),
                new KakaoLocalProperties("https://dapi.kakao.com", "test-key", 1000, 3000)
        );

        server.expect(requestTo(containsString("/v2/routing/walk")))
                .andExpect(requestTo(containsString("start_x=127.0365")))
                .andExpect(requestTo(containsString("end_y=37.5012")))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "KakaoAK test-key"))
                .andRespond(withSuccess("""
                        {
                          "route": {
                            "properties": {
                              "totalDistance": 2450,
                              "totalTime": 2295
                            }
                          },
                          "landingUrl": "https://map.kakao.com/example"
                        }
                        """, MediaType.APPLICATION_JSON));

        KakaoWalkingRouteResult result = client.findWalkingRoute(
                new BigDecimal("127.0365"),
                new BigDecimal("37.5007"),
                new BigDecimal("127.0401"),
                new BigDecimal("37.5012")
        );

        assertThat(result.distanceMeters()).isEqualTo(2450L);
        assertThat(result.estimatedTimeSeconds()).isEqualTo(2295L);
        assertThat(result.landingUrl()).isEqualTo("https://map.kakao.com/example");
        server.verify();
    }

    @Test
    void searchPlacesMapsKakaoLocalResponse() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClientKakaoLocalClient client = new RestClientKakaoLocalClient(
                builder.build(),
                new KakaoLocalProperties("https://dapi.kakao.com", "test-key", 1000, 3000)
        );

        server.expect(requestTo(containsString("/v2/local/search/keyword.json")))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "KakaoAK test-key"))
                .andRespond(withSuccess("""
                        {
                          "documents": [
                            {
                              "id": "18577297",
                              "place_name": "강남파이낸스센터",
                              "category_name": "서비스,산업 > 기업",
                              "address_name": "서울 강남구 역삼동 737",
                              "road_address_name": "서울 강남구 테헤란로 152",
                              "x": "127.036431",
                              "y": "37.500029",
                              "distance": "75"
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        List<KakaoPlaceSearchResult> results = client.searchPlaces(
                "강남파이낸스센터",
                new BigDecimal("127.036500"),
                new BigDecimal("37.500700")
        );

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.placeId()).isEqualTo("18577297");
            assertThat(result.name()).isEqualTo("강남파이낸스센터");
            assertThat(result.address()).isEqualTo("서울 강남구 테헤란로 152");
            assertThat(result.latitude()).isEqualByComparingTo("37.500029");
            assertThat(result.longitude()).isEqualByComparingTo("127.036431");
            assertThat(result.distanceMeters()).isEqualTo(75L);
        });
        server.verify();
    }

    @Test
    void searchSubwayStationsNarrowsToSubwayCategoryWithoutCenterCoordinates() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClientKakaoLocalClient client = new RestClientKakaoLocalClient(
                builder.build(),
                new KakaoLocalProperties("https://dapi.kakao.com", "test-key", 1000, 3000)
        );

        server.expect(requestTo(containsString("category_group_code=SW8")))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "KakaoAK test-key"))
                .andRespond(withSuccess("""
                        {
                          "documents": [
                            {
                              "id": "21160338",
                              "place_name": "선릉역 2호선",
                              "category_name": "교통,수송 > 지하철,전철 > 수도권2호선",
                              "address_name": "서울 강남구 삼성동 172-66",
                              "road_address_name": "서울 강남구 테헤란로 340",
                              "x": "127.048913",
                              "y": "37.504520",
                              "distance": ""
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        List<KakaoPlaceSearchResult> results = client.searchSubwayStations("선릉");

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.name()).isEqualTo("선릉역 2호선");
            assertThat(result.address()).isEqualTo("서울 강남구 테헤란로 340");
            assertThat(result.distanceMeters()).isNull();
        });
        server.verify();
    }

    @Test
    void searchSubwayStationsReturnsEmptyWhenApiKeyIsMissing() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClientKakaoLocalClient client = new RestClientKakaoLocalClient(
                builder.build(),
                new KakaoLocalProperties("https://dapi.kakao.com", "", 1000, 3000)
        );

        assertThat(client.searchSubwayStations("선릉")).isEmpty();
        server.verify();
    }

    @Test
    void searchNearbySubwayStationsUsesCategoryAndCenterCoordinates() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClientKakaoLocalClient client = new RestClientKakaoLocalClient(
                builder.build(),
                new KakaoLocalProperties("https://dapi.kakao.com", "test-key", 1000, 3000)
        );

        server.expect(requestTo(containsString("/v2/local/search/category.json")))
                .andExpect(requestTo(containsString("category_group_code=SW8")))
                .andExpect(requestTo(containsString("x=127.036500")))
                .andExpect(requestTo(containsString("y=37.500700")))
                .andRespond(withSuccess("""
                        {"documents":[{
                          "id":"2","place_name":"선릉역 2호선",
                          "category_name":"교통,수송 > 지하철,전철 > 수도권2호선",
                          "address_name":"서울 강남구 삼성동","road_address_name":"",
                          "x":"127.048913","y":"37.504520","distance":"420"
                        }]}
                        """, MediaType.APPLICATION_JSON));

        List<KakaoPlaceSearchResult> results = client.searchNearbySubwayStations(
                new BigDecimal("127.036500"),
                new BigDecimal("37.500700")
        );

        assertThat(results).singleElement().satisfies(result -> {
            assertThat(result.name()).isEqualTo("선릉역 2호선");
            assertThat(result.distanceMeters()).isEqualTo(420L);
        });
        server.verify();
    }

    @Test
    void searchPlacesReturnsEmptyWhenApiKeyIsMissing() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://dapi.kakao.com");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        RestClientKakaoLocalClient client = new RestClientKakaoLocalClient(
                builder.build(),
                new KakaoLocalProperties("https://dapi.kakao.com", "", 1000, 3000)
        );

        List<KakaoPlaceSearchResult> results = client.searchPlaces(
                "강남파이낸스센터",
                new BigDecimal("127.036500"),
                new BigDecimal("37.500700")
        );

        assertThat(results).isEmpty();
        server.verify();
    }
}
