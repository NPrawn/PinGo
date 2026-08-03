package com.pingo.backend.route.dto.request;

import com.pingo.backend.usersession.domain.Language;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 선택한 경로 옵션으로 실내 경로 상세를 생성하는 요청.
 * routeType 은 fastest · elevator_only 중 하나이며, 값 검증은 서비스에서 RouteType.fromCode 로 수행한다.
 *
 * <p>{@code language} 는 이용 불가 사유 문구({@code unavailableMessage})의 언어다. 이 요청에는
 * 세션 ID 가 없어 서버가 사용자의 언어를 알 방법이 없으므로 클라이언트가 실어 보낸다.
 */
public record RouteCreateRequest(
        @NotNull
        Long stationId,

        @NotNull
        Long startNodeId,

        @NotNull
        Long targetNodeId,

        @Size(max = 10)
        List<@NotNull Long> waypointNodeIds,

        @NotBlank
        @Size(max = 50)
        String routeType,

        /** 생략하면 {@link Language#DEFAULT}. */
        Language language
) {

    public RouteCreateRequest {
        waypointNodeIds = waypointNodeIds == null ? List.of() : waypointNodeIds;
        language = language == null ? Language.DEFAULT : language;
    }
}
