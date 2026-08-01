package com.pingo.backend.localization.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * 캐노니컬 수평면의 2D 단위벡터. 각도가 아니다.
 *
 * <p><b>각도로 주지 않는 이유</b>는 FE 스펙 8.5 에 있다. 각도는 0도 기준(+X 축인가 진북인가)과
 * 증가 방향(시계인가 반시계인가)을 따로 합의해야 하고, 어긋나도 오류가 나지 않아 조용히 틀린다.
 * 벡터는 그 논쟁이 없다.
 *
 * <p>길이는 1 이다. 백엔드에서 정규화해 내보내므로 FE 가 다시 정규화할 필요가 없다.
 */
@Schema(description = "캐노니컬 수평면의 2D 단위벡터. 길이 1 로 정규화돼 있다.")
public record PlanarDirectionResponse(

        @Schema(description = "캐노니컬 X 성분", example = "0.93")
        BigDecimal x,

        @Schema(description = "캐노니컬 Y 성분", example = "-0.36")
        BigDecimal y
) {
}
