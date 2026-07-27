package com.pingo.backend.externalmap.service;

import com.pingo.backend.externalmap.dto.request.ExternalDirectionRequest;
import com.pingo.backend.externalmap.dto.response.ExternalDirectionResponse;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Service;

@Service
public class ExternalMapService {

    private static final String KAKAO_PROVIDER = "kakao";
    private static final String WALKING_MODE = "walking";
    private static final String KAKAO_WALKING_MODE = "foot";

    public ExternalDirectionResponse createDirection(ExternalDirectionRequest request) {
        if (!KAKAO_PROVIDER.equalsIgnoreCase(request.provider())
        || !WALKING_MODE.equalsIgnoreCase(request.mode())) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        String origin = formatPoint(request.origin().latitude().toPlainString(),
                request.origin().longitude().toPlainString());
        String destination = formatPoint(request.destination().latitude().toPlainString(),
                request.origin().latitude().toPlainString());
        String destinationName = encode(request.destination().name());

        String appUrl = "kakaomap://route"
                + "?sp=" + origin
                + "&ep=" + destination
                + "&by=" + KAKAO_WALKING_MODE;

        String webUrl = "https://map.kakao.com/link/by/walk/"
                + encode("현재 위치") + "," + origin
                + "/"
                + destinationName + "," + destination;

        return new ExternalDirectionResponse(KAKAO_PROVIDER, appUrl, webUrl);
    }

    private String formatPoint(String latitude, String longitude) {
        return latitude + "," + longitude;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
