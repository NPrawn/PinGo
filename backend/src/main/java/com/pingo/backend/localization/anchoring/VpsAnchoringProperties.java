package com.pingo.backend.localization.anchoring;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.Map;

/**
 * COLMAP 좌표를 캐노니컬 평면도 좌표(미터)로 옮기는 층별 변환 계수.
 *
 * <p>층마다 별개의 COLMAP 재구성이 있고 재구성마다 좌표계와 축척이 임의로 정해지므로,
 * 변환은 하나로 통합되지 않고 <b>층 단위</b>로 둔다. 값의 출처와 검증 수치는
 * {@code ai/tools/colmap_align_result.json} 에 있다.
 *
 * <pre>
 *   canonicalX = m[0]*cx + m[1]*cy + m[2]*cz + offset[0]
 *   canonicalY = m[3]*cx + m[4]*cy + m[5]*cz + offset[1]
 * </pre>
 *
 * <p><b>높이는 이 변환으로 얻지 못한다.</b> 정합 기준점이 모두 같은 층 바닥 높이라
 * 캐노니컬 z 가 상수였고, 그래서 z 방향은 데이터가 결정해주지 않는다. 높이는
 * {@code nominalZ} 로 대신한다. 같은 층 안에서 높이가 갈리는 구간(역삼역 B0.5, z=7.5)은
 * 이 값으로 구분할 수 없으며, 구분하려면 서로 다른 높이의 기준점이 필요하다.
 *
 * <p><b>계수는 특정 역의 특정 재구성에 종속된다.</b> 층 코드(B1·B2·B3)는 역마다 겹치므로
 * {@code stationId} 를 함께 두고 요청한 역과 대조한다. 대조하지 않으면 다른 역의 B2 요청에
 * 역삼역 계수가 적용돼 수십 미터 어긋난 좌표가 오류 없이 나간다.
 *
 * <p>설정에 없는 층은 정합이 되지 않은 층이다. 0 으로 계산해 엉뚱한 좌표를 내지 말고
 * 위치를 확정하지 못한 것으로 응답해야 한다(역삼역 B1 이 현재 그렇다).
 */
@Validated
@ConfigurationProperties(prefix = "vps.anchoring")
public record VpsAnchoringProperties(

        /** 층 코드(B1·B2·B3) -> 변환 계수. 비어 있으면 앵커링을 수행하지 않는다. */
        Map<String, @Valid FloorFrame> floors
) {

    public VpsAnchoringProperties {
        floors = floors == null ? Map.of() : Map.copyOf(floors);
    }

    /**
     * 해당 역·층의 계수. 역이 다르면 계수가 있어도 쓰지 않는다.
     */
    public FloorFrame frameOf(Long stationId, String floorCode) {
        if (stationId == null || floorCode == null) {
            return null;
        }
        FloorFrame frame = floors.get(floorCode);
        return frame != null && stationId.equals(frame.stationId()) ? frame : null;
    }

    public record FloorFrame(

            /** 이 계수가 속한 역 ID. 요청한 역과 다르면 적용하지 않는다. */
            @NotNull
            Long stationId,

            /** 2x3 어파인 계수. 행 우선(row-major)으로 여섯 개. */
            @NotNull
            @Size(min = 6, max = 6)
            double[] m,

            /** 평행이동 두 개. */
            @NotNull
            @Size(min = 2, max = 2)
            double[] offset,

            /** 이 층 바닥의 캐노니컬 높이(m). 변환으로 얻을 수 없어 상수로 둔다. */
            @NotNull
            Double nominalZ,

            /**
             * 위치 정확도(m). <b>leave-one-out 평균</b>이며 in-sample 잔차가 아니다.
             *
             * <p>기준점 위에서 잰 잔차 RMS 는 그 기준점으로 맞춘 값이라 낙관적이다.
             * 역삼역 B3 는 RMS 0.594m 인데 leave-one-out 평균은 1.095m 다. 이 값을
             * 클라이언트가 정확도 원으로 쓰므로 일반화 오차 쪽을 싣는다.
             */
            @NotNull
            Double accuracyM
    ) {
    }
}
