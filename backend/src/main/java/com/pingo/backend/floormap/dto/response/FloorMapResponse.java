package com.pingo.backend.floormap.dto.response;

import com.pingo.backend.floormap.domain.FloorMap;

import java.math.BigDecimal;

/**
 * 층별 지도 응답. 이미지 정보와 함께 <b>좌표 프레임</b>을 내려준다.
 *
 * <p>노드·경로·현재위치 좌표는 캐노니컬 미터로 내려가므로, 지도 위에 그리려면 클라이언트가
 * 이 프레임으로 픽셀 변환을 해야 한다. 결과는 <b>원본 이미지 픽셀</b>이며, 화면에 축소·확대해
 * 그린다면 표시크기/원본크기 배율을 추가로 곱한다.
 *
 * <pre>
 * t = frameAngleDeg 를 라디안으로, c = cos(t), s = sin(t)
 * px = originPxX + (c*x - s*y) / scaleMPerPx
 * py = originPxY + (s*x + c*y) / scaleMPerPx
 * </pre>
 *
 * <p>{@code scaleMPerPx}·{@code originPxX}·{@code originPxY}·{@code frameAngleDeg} 가
 * <b>모두 있어야</b> 변환이 가능하다. 하나라도 null 이면 지도 이미지는 표시할 수 있으나
 * 좌표 오버레이는 할 수 없다. 층마다 값이 다르므로 층별로 사용해야 한다.
 *
 * <p>{@code mapUrl} 은 null 일 수 있다. 좌표 프레임만 등록되고 이미지는 아직 없는 상태이며,
 * 이때 클라이언트는 자체 이미지를 쓰고 프레임만 가져다 쓰면 된다.
 * 단, 자체 이미지가 기준 이미지({@code width}×{@code height})를 확대·축소한 것이어야
 * 프레임이 그대로 성립한다. 잘라내거나 배치를 바꾸면 프레임을 다시 측정해야 한다.
 */
public record FloorMapResponse(
        Long mapId,
        Long floorId,
        String floorCode,
        String mapType,
        String mapUrl,
        Integer width,
        Integer height,
        BigDecimal scaleMPerPx,
        BigDecimal originPxX,
        BigDecimal originPxY,
        BigDecimal frameAngleDeg,
        String version
) {

    public static FloorMapResponse of(FloorMap floorMap, String floorCode) {
        return new FloorMapResponse(
                floorMap.getId(),
                floorMap.getFloorId(),
                floorCode,
                floorMap.getMapType(),
                floorMap.getMapUrl(),
                floorMap.getWidth(),
                floorMap.getHeight(),
                floorMap.getScaleMPerPx(),
                floorMap.getOriginPxX(),
                floorMap.getOriginPxY(),
                floorMap.getFrameAngleDeg(),
                floorMap.getVersion()
        );
    }
}
