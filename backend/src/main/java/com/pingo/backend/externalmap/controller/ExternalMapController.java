package com.pingo.backend.externalmap.controller;

import com.pingo.backend.externalmap.dto.request.ExternalDirectionRequest;
import com.pingo.backend.externalmap.dto.response.ExternalDirectionResponse;
import com.pingo.backend.externalmap.service.ExternalMapService;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/external-maps")
@RequiredArgsConstructor
@Tag(name = "외부 지도 연계 API", description = "비로그인 사용자가 외부 지도 앱 또는 웹으로 길찾기를 실행하기 위한 API")
public class ExternalMapController {

    private final ExternalMapService externalMapService;

    @PostMapping("/directions")
    @SecurityRequirements
    @Operation(
            summary = "카카오맵 길찾기 URL 생성",
            description = "현재 위치와 목적지 정보를 받아 카카오맵 앱 딥링크와 웹 길찾기 URL을 생성한다. 인증이 필요 없는 공개 API다."
    )
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200",
                    description = "카카오맵 길찾기 URL 생성 성공",
                    content = @Content(
                            schema = @Schema(implementation = ExternalDirectionResponse.class),
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "success": true,
                                              "data": {
                                                "provider": "kakao",
                                                "appUrl": "kakaomap://route?sp=37.5665,126.9780&ep=37.4979,127.0276&by=foot",
                                                "webUrl": "https://map.kakao.com/link/by/walk/현재 위치,37.5665,126.9780/강남역,37.4979,127.0276"
                                              }
                                            }
                                            """
                            )
                    )
            ),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400",
                    description = "지원하지 않는 provider/mode 또는 요청 값 검증 실패",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "success": false,
                                              "code": "BAD_REQUEST",
                                              "message": "지원하지 않는 외부 지도 제공자입니다."
                                            }
                                            """
                            )
                    )
            )
    })
    public ApiResponse<ExternalDirectionResponse> createDirection(
            @Valid @RequestBody ExternalDirectionRequest request
    ) {
        return ApiResponse.success(externalMapService.createDirection(request));
    }
}
