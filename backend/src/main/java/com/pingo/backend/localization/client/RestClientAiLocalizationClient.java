package com.pingo.backend.localization.client;

import com.pingo.backend.localization.client.dto.AiLocalizationRequestMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import java.io.IOException;
import java.net.SocketTimeoutException;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

@Component
public class RestClientAiLocalizationClient implements AiLocalizationClient {

    private static final String REQUEST_ID_HEADER = "X-Request-Id";
    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final RestClient restClient;
    private final AiLocalizationProperties properties;

    public RestClientAiLocalizationClient(
            RestClient ailocalizationRestClient,
            AiLocalizationProperties properties
    ) {
        this.restClient = ailocalizationRestClient;
        this.properties = properties;
    }

    @Override
    public AiLocalizationResponse localize(
            String requestId,
            String mapVersion,
            MultipartFile image,
            AiLocalizationRequestMetadata metadata
    ) {
        try {
            LinkedMultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("image", imagePart(image));
            body.add("metadata", metadataPart(metadata));

            return restClient.post()
                    .uri("/internal/v1/maps/{mapVersion}/localize", mapVersion)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .header(REQUEST_ID_HEADER, requestId)
                    .headers(headers -> addInternalToken(headers, properties.internalToken()))
                    .body(body)
                    .exchange((request, response) -> readResponse(response.getStatusCode(),
                            response.bodyTo(AiLocalizationResponse.class)));
        } catch (ResourceAccessException e) {
            throw new AiLocalizationClientException(resolveAccessErrorType(e), "AI 위치추정 서버 호출에 실패했습니다", e);
        } catch (RestClientException e) {
            throw new AiLocalizationClientException(AiLocalizationClientErrorType.INTERNAL_ERROR,
                    "AI 위치추정 서버 응답 처리에 실패했습니다", e);
        } catch (IOException e) {
            throw new AiLocalizationClientException(AiLocalizationClientErrorType.INTERNAL_ERROR,
                    "AI 위치추정 요청 생성에 실패했습니다", e);
        }
    }

    private HttpEntity<ByteArrayResource> imagePart(MultipartFile image) throws IOException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(resolveImageContentType(image));

        ByteArrayResource resource = new ByteArrayResource(image.getBytes()) {
            @Override
            public String getFilename() {
                return image.getOriginalFilename();
            }
        };

        return new HttpEntity<>(resource, headers);
    }

    private HttpEntity<AiLocalizationRequestMetadata> metadataPart(AiLocalizationRequestMetadata metadata) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(metadata, headers);
    }

    private MediaType resolveImageContentType(MultipartFile image) {
        if (image.getContentType() == null) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }

        return MediaType.parseMediaType(image.getContentType());
    }

    private void addInternalToken(HttpHeaders headers, String internalToken) {
        if (internalToken != null && !internalToken.isBlank()) {
            headers.set(INTERNAL_TOKEN_HEADER, internalToken);
        }
    }

    private AiLocalizationResponse readResponse(HttpStatusCode statusCode, AiLocalizationResponse response) {
        if (response != null) {
            return response;
        }

        AiLocalizationClientErrorType errorType = statusCode.is5xxServerError()
                ? AiLocalizationClientErrorType.UNAVAILABLE
                : AiLocalizationClientErrorType.BAD_REQUEST;

        throw new AiLocalizationClientException(errorType, "AI 위치추정 서버 응답 본문이 비어 있습니다.");
    }

    private AiLocalizationClientErrorType resolveAccessErrorType(ResourceAccessException e) {
        return hasCause(e, SocketTimeoutException.class)
                ? AiLocalizationClientErrorType.TIMEOUT
                : AiLocalizationClientErrorType.UNAVAILABLE;
    }

    private boolean hasCause(Throwable throwable, Class<? extends Throwable> causeType) {
        Throwable current = throwable;
        while (current != null) {
            if (causeType.isInstance(current)) {
                return true;
            }

            current = current.getCause();
        }
        return false;
    }
}
