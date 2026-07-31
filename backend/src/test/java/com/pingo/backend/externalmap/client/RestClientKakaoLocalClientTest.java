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
