package com.pingo.backend.localization.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.pingo.backend.localization.client.dto.AiCameraMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationRequestMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationStatus;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RestClientAiLocalizationClientTest {

    private MockRestServiceServer server;
    private RestClientAiLocalizationClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl("http://ai.test");
        server = MockRestServiceServer.bindTo(builder).build();

        client = new RestClientAiLocalizationClient(
                builder.build(),
                new AiLocalizationProperties("http://ai.test", "secret-token", 300, 6000)
        );
    }

    @Test
    void localizeSendsMultipartRequestAndReadsResponse() {
        server.expect(requestTo("http://ai.test/internal/v1/maps/YS-2026-07-23.1/localize"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Request-Id", "loc-1"))
                .andExpect(header("X-Internal-Token", "secret-token"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.MULTIPART_FORM_DATA))
                .andRespond(withSuccess("""
                        {
                          "requestId": "loc-1",
                          "status": "LOCALIZED",
                          "mapVersion": "YS-2026-07-23.1",
                          "selectedMapVersion": "YS-2026-07-23.1",
                          "floor": "B2",
                          "pose": null,
                          "quality": null,
                          "mapResults": [],
                          "timingMs": {
                            "total": 1234
                          },
                          "failureReason": null
                        }
                        """, MediaType.APPLICATION_JSON));

        var response = client.localize("loc-1", "YS-2026-07-23.1", image(), metadata());

        assertThat(response.requestId()).isEqualTo("loc-1");
        assertThat(response.status()).isEqualTo(AiLocalizationStatus.LOCALIZED);
        assertThat(response.mapVersion()).isEqualTo("YS-2026-07-23.1");
        assertThat(response.timingMs().total()).isEqualTo(1234);
        server.verify();
    }

    @Test
    void localizeThrowsUnavailableWhenServerErrorBodyIsEmpty() {
        server.expect(requestTo("http://ai.test/internal/v1/maps/YS-2026-07-23.1/localize"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError());

        assertThatThrownBy(() -> client.localize("loc-1", "YS-2026-07-23.1", image(), metadata()))
                .isInstanceOfSatisfying(AiLocalizationClientException.class, exception ->
                        assertThat(exception.getErrorType()).isEqualTo(AiLocalizationClientErrorType.UNAVAILABLE)
                );
        server.verify();
    }

    private MockMultipartFile image() {
        return new MockMultipartFile(
                "image",
                "query.jpg",
                "image/jpeg",
                "image".getBytes()
        );
    }

    private AiLocalizationRequestMetadata metadata() {
        return new AiLocalizationRequestMetadata(
                1L,
                new AiCameraMetadata(
                        "PINHOLE",
                        1280,
                        720,
                        List.of(1050.2, 1048.8, 640.0, 360.0),
                        "DEVICE_PROFILE"
                ),
                Instant.parse("2026-07-23T08:10:11.123Z")
        );
    }
}
