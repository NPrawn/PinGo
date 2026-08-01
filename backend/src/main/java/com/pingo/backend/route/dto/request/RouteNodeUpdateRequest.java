package com.pingo.backend.route.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record RouteNodeUpdateRequest(
        @NotBlank
        @Size(max = 50)
        String nodeType,

        @Size(max = 100)
        String name,

        @NotNull
        BigDecimal mapX,

        @NotNull
        BigDecimal mapY,

        @Schema(
                description = """
                        캐노니컬 높이(m). 층 바닥이 기준이고 역삼역은 B1=5 · B2=0 · B3=-5.
                        비워 두면 위치 인식의 노드 스냅이 이 노드를 바닥에 있는 것으로 보므로,
                        같은 층 안에서 높이가 갈리는 구간(역삼역 B0.5, z=7.5)에서는 되도록 넣는다.
                        """,
                example = "0.0"
        )
        BigDecimal mapZ,

        Boolean isLandmark
) {
}
