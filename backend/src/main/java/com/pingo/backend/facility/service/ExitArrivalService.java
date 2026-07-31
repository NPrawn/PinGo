package com.pingo.backend.facility.service;

import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.domain.FacilityType;
import com.pingo.backend.facility.dto.request.ExitArrivalCheckRequest;
import com.pingo.backend.facility.dto.response.ExitArrivalResponse;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 출구 도착 판정 (FR-U-011).
 *
 * <p>사용자가 목적지로 정한 출구에 도착했는지 판단한다. 주변 출구를 훑지 않고
 * 요청받은 출구 하나만 확인하므로, 가까이 붙은 출구끼리 서로 오검출되지 않는다.
 *
 * <p>판정은 <b>같은 층 + 평면 거리 임계값 이하</b>다. 높이는 쓰지 않는다 —
 * 클라이언트가 높이를 추적하지 않고, 같은 층 안에서 높이가 갈리는 역삼역 B0.5 중간층도
 * 가장 가까운 출구와 14.7m 떨어져 있어 평면 거리만으로 구분된다.
 *
 * <p>자동 판정이 어려울 때 사용자가 직접 도착을 선택하는 흐름은 클라이언트가 처리한다.
 * 이 서비스는 판단만 제공하고 세션 상태를 바꾸지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExitArrivalService {

    private final FacilityRepository facilityRepository;

    /**
     * 도착으로 판정하는 평면 거리(m).
     *
     * <p>아래에서 눌리는 값과 위에서 눌리는 값 사이가 좁다.
     * <ul>
     *     <li>아래: 위치 오차를 넘어야 한다. 역삼역 B1 좌표 프레임이 미검증이라 최대 4.4m,
     *         축척(0.19 m/px)이 provisional 이라 출구 거리에서 1~1.6m 가 더해진다.
     *         임계값이 오차보다 작으면 출구 앞에 서 있어도 도착이 뜨지 않는다.</li>
     *     <li>위: 가장 가까운 출구 쌍이 18.3m(7번·8번)라, 절반인 9m 를 크게 넘기면
     *         판정 영역이 겹치기 시작한다.</li>
     * </ul>
     *
     * <p>S15P11A206-314(B1 프레임 확정)와 sim3 정합으로 오차가 줄면 5~6m 로 조일 수 있다.
     * 그래서 상수가 아니라 설정값으로 둔다.
     */
    @Value("${exit.arrival.threshold-m:10.0}")
    private BigDecimal thresholdM;

    public ExitArrivalResponse checkArrival(Long facilityId, ExitArrivalCheckRequest request) {
        Facility exit = facilityRepository.findByIdAndActiveTrue(facilityId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FACILITY_NOT_FOUND));

        if (!FacilityType.EXIT.getCode().equals(exit.getFacilityType())) {
            throw new BusinessException(ErrorCode.NOT_EXIT_FACILITY);
        }

        boolean sameFloor = exit.getFloorId().equals(request.floorId());
        if (!sameFloor) {
            // 층이 다르면 평면 거리는 의미가 없다. B1 출구 바로 아래 B2 지점이 가깝게 나오는 것을 막는다.
            return new ExitArrivalResponse(
                    exit.getId(), exit.getNameKo(), exit.getNameEn(), exit.getFloorId(),
                    false, false, null, thresholdM);
        }

        // 좌표는 DB NOT NULL 이고 시설 생성 DTO 에도 @NotNull 이라 여기서 비어 있을 수 없다.
        // 그래도 비어 있다면 사용자 잘못이 아니라 데이터 결함이므로 500 으로 드러낸다.
        if (exit.getMapX() == null || exit.getMapY() == null) {
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        BigDecimal distance = planarDistance(
                request.mapX(), request.mapY(), exit.getMapX(), exit.getMapY());

        return new ExitArrivalResponse(
                exit.getId(), exit.getNameKo(), exit.getNameEn(), exit.getFloorId(),
                distance.compareTo(thresholdM) <= 0, true, distance, thresholdM);
    }

    /**
     * 캐노니컬 미터 좌표 두 점 사이의 평면 거리. 소수 둘째 자리까지 반올림한다.
     *
     * <p>{@code BigDecimal} 로 받은 좌표를 {@code double} 로 계산한다. 좌표 범위가 수백 미터라
     * double 정밀도가 충분하고, 결과를 다시 반올림하므로 오차가 표시값에 영향을 주지 않는다.
     */
    private BigDecimal planarDistance(BigDecimal x1, BigDecimal y1, BigDecimal x2, BigDecimal y2) {
        double dx = x1.doubleValue() - x2.doubleValue();
        double dy = y1.doubleValue() - y2.doubleValue();
        return BigDecimal.valueOf(Math.hypot(dx, dy)).setScale(2, RoundingMode.HALF_UP);
    }
}
