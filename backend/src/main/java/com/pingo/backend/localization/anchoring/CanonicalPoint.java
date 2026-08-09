package com.pingo.backend.localization.anchoring;

/**
 * 캐노니컬 평면도 좌표(미터). 원점은 역삼역 B2-B3 엘리베이터 B 이고 +X 는 6번 출구 방향이다.
 *
 * <p>{@code z} 는 변환으로 얻은 값이 아니라 해당 층의 기준 높이다. 근거는
 * {@link VpsAnchoringProperties} 주석에 있다.
 */
public record CanonicalPoint(double x, double y, double z) {
}
