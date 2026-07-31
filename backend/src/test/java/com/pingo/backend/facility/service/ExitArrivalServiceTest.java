package com.pingo.backend.facility.service;

import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.dto.request.ExitArrivalCheckRequest;
import com.pingo.backend.facility.dto.response.ExitArrivalResponse;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExitArrivalServiceTest {

    private static final Long EXIT_ID = 42L;
    private static final Long B1 = 3L;
    private static final Long B2 = 1L;

    @Mock
    private FacilityRepository facilityRepository;

    private ExitArrivalService exitArrivalService;

    @BeforeEach
    void setUp() {
        exitArrivalService = new ExitArrivalService(facilityRepository);
        ReflectionTestUtils.setField(exitArrivalService, "thresholdM", new BigDecimal("10.0"));
    }

    @Test
    void arrivesWhenWithinThresholdOnSameFloor() {
        givenExit(exitAt(B1, "100.000", "-40.000"));

        // 출구에서 3m 떨어진 지점
        ExitArrivalResponse response = check(B1, "103.000", "-40.000");

        assertThat(response.arrived()).isTrue();
        assertThat(response.sameFloor()).isTrue();
        assertThat(response.distanceM()).isEqualByComparingTo("3.00");
        assertThat(response.thresholdM()).isEqualByComparingTo("10.0");
    }

    @Test
    void doesNotArriveWhenBeyondThreshold() {
        givenExit(exitAt(B1, "100.000", "-40.000"));

        // 12m 떨어진 지점
        ExitArrivalResponse response = check(B1, "100.000", "-28.000");

        assertThat(response.arrived()).isFalse();
        assertThat(response.sameFloor()).isTrue();
        assertThat(response.distanceM()).isEqualByComparingTo("12.00");
    }

    @Test
    void arrivesExactlyAtThreshold() {
        givenExit(exitAt(B1, "100.000", "-40.000"));

        // 경계값 10m 는 도착으로 본다
        ExitArrivalResponse response = check(B1, "110.000", "-40.000");

        assertThat(response.distanceM()).isEqualByComparingTo("10.00");
        assertThat(response.arrived()).isTrue();
    }

    @Test
    void doesNotArriveOnDifferentFloorEvenIfPlanarDistanceIsZero() {
        givenExit(exitAt(B1, "100.000", "-40.000"));

        // B1 출구 바로 아래 B2 지점. 평면 거리는 0 이지만 층이 다르므로 도착이 아니다.
        ExitArrivalResponse response = check(B2, "100.000", "-40.000");

        assertThat(response.arrived()).isFalse();
        assertThat(response.sameFloor()).isFalse();
        assertThat(response.distanceM()).isNull();
    }

    @Test
    void throwsWhenFacilityIsNotAnExit() {
        Facility restroom = Facility.create(
                1L, B1, "restroom", "화장실", "Restroom",
                new BigDecimal("39.500"), new BigDecimal("25.800"), null, true);
        ReflectionTestUtils.setField(restroom, "id", EXIT_ID);
        when(facilityRepository.findByIdAndActiveTrue(EXIT_ID)).thenReturn(Optional.of(restroom));

        assertThatThrownBy(() -> check(B1, "39.500", "25.800"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.NOT_EXIT_FACILITY));
    }

    @Test
    void throwsWhenExitDoesNotExist() {
        when(facilityRepository.findByIdAndActiveTrue(EXIT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> check(B1, "100.000", "-40.000"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NOT_FOUND));
    }

    private void givenExit(Facility exit) {
        when(facilityRepository.findByIdAndActiveTrue(EXIT_ID)).thenReturn(Optional.of(exit));
    }

    private Facility exitAt(Long floorId, String mapX, String mapY) {
        Facility exit = Facility.create(
                1L, floorId, "exit", "6번 출구", "Exit 6",
                new BigDecimal(mapX), new BigDecimal(mapY), null, false);
        ReflectionTestUtils.setField(exit, "id", EXIT_ID);
        return exit;
    }

    private ExitArrivalResponse check(Long floorId, String mapX, String mapY) {
        return exitArrivalService.checkArrival(EXIT_ID,
                new ExitArrivalCheckRequest(floorId, new BigDecimal(mapX), new BigDecimal(mapY)));
    }
}
