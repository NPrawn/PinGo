package com.pingo.backend.station.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record FloorCreateRequest(
        @NotBlank
        @Size(max = 20)
        String floorCode,

        @Size(max = 100)
        String floorName,

        @NotNull
        Integer floorOrder,

        @Schema(
                description = """
                        층의 캐노니컬 기준 높이(m). 역삼역은 B1=5 · B2=0 · B3=-5.
                        클라이언트가 층 전환을 ΔY 로 판정하는 데 쓰므로 되도록 넣는다.
                        """,
                example = "0.0"
        )
        BigDecimal nominalZ
) {
}
