package com.pingo.backend.localization.anchoring;

/**
 * 캐노니컬 수평면의 2D 단위벡터. 앵커 시점 단말이 향한 방향을 나타낸다.
 *
 * <p>{@link CanonicalPoint} 와 같은 프레임이다. 원점은 역삼역 B2-B3 엘리베이터 B 이고
 * +X 는 6번 출구 방향이다. 다만 이쪽은 <b>방향</b>이라 평행이동을 적용하지 않는다.
 *
 * <p>높이 성분이 없다. 층은 {@code floorId} 로 판정하고(FE 스펙 8.4) 캐노니컬 z 는 명목
 * 층높이라 방향에 쓸 값이 아니다.
 */
public record CanonicalDirection(double x, double y) {
}
