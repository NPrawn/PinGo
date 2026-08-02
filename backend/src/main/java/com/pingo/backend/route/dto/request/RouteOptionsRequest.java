package com.pingo.backend.route.dto.request;

import com.pingo.backend.usersession.domain.Language;
import jakarta.validation.constraints.NotNull;

/**
 * 경로 옵션 조회 요청. 출발 노드에서 도착 노드까지의 경로 옵션(빠른 경로·엘리베이터 이용 경로)을 조회한다.
 * 도착 노드는 외부 목적지·출구 추천이 아니라 실내 노드 ID로 직접 지정한다.
 *
 * <p>{@code language} 는 이용 불가 사유 문구({@code unavailableMessage})의 언어다. 이 요청에는
 * 세션 ID 가 없어 서버가 사용자의 언어를 알 방법이 없으므로 클라이언트가 실어 보낸다. 목적지 검색·
 * 편의시설·역 검색 API 가 쓰는 {@code language} 와 같은 값이다.
 */
public record RouteOptionsRequest(
        @NotNull
        Long stationId,

        @NotNull
        Long startNodeId,

        @NotNull
        Long targetNodeId,

        /** 생략하면 {@link Language#DEFAULT}. */
        Language language
) {

    public RouteOptionsRequest {
        language = language == null ? Language.DEFAULT : language;
    }
}
