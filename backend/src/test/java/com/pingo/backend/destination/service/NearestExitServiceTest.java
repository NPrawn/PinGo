package com.pingo.backend.destination.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.pingo.backend.destination.dto.request.NearestExitRequest;
import com.pingo.backend.destination.dto.response.NearestExitResponse;
import com.pingo.backend.facility.domain.ExitDetail;
import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.repository.ExitDetailRepository;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class NearestExitServiceTest {

    @Mock
    private StationRepository stationRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private ExitDetailRepository exitDetailRepository;

    private NearestExitService nearestExitService;

    @BeforeEach
    void setUp() {
        nearestExitService = new NearestExitService(
                stationRepository,
                facilityRepository,
                exitDetailRepository
        );
    }

    @Test
    void findNearestExitComparesExitToDestinationStraightLineDistance() {
        NearestExitRequest request = request();
        Facility exitOne = exitFacility(10L, "1번 출구");
        Facility exitFive = exitFacility(50L, "5번 출구");

        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station()));
        when(facilityRepository.searchActive(1L, null, "exit"))
                .thenReturn(List.of(exitOne, exitFive));
        when(exitDetailRepository.findAllByFacilityIdIn(List.of(10L, 50L))).thenReturn(List.of(
                ExitDetail.create(
                        10L,
                        "1",
                        new BigDecimal("37.490000"),
                        new BigDecimal("127.020000"),
                        null,
                        null
                ),
                ExitDetail.create(
                        50L,
                        "5",
                        new BigDecimal("37.500000"),
                        new BigDecimal("127.036000"),
                        null,
                        null
                )
        ));

        NearestExitResponse response = nearestExitService.findNearestExit(request);

        assertThat(response.exitFacilityId()).isEqualTo(50L);
        assertThat(response.exitNumber()).isEqualTo("5");
    }

    @Test
    void findNearestExitSkipsExitWithoutCompleteOutsideCoordinates() {
        NearestExitRequest request = request();
        Facility incompleteExit = exitFacility(10L, "1번 출구");
        Facility completeExit = exitFacility(50L, "5번 출구");

        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station()));
        when(facilityRepository.searchActive(1L, null, "exit"))
                .thenReturn(List.of(incompleteExit, completeExit));
        when(exitDetailRepository.findAllByFacilityIdIn(List.of(10L, 50L))).thenReturn(List.of(
                ExitDetail.create(10L, "1", new BigDecimal("37.500000"), null, null, null),
                ExitDetail.create(
                        50L,
                        "5",
                        new BigDecimal("37.500000"),
                        new BigDecimal("127.036000"),
                        null,
                        null
                )
        ));

        NearestExitResponse response = nearestExitService.findNearestExit(request);

        assertThat(response.exitFacilityId()).isEqualTo(50L);
    }

    @Test
    void findNearestExitThrowsWhenNoExitHasOutsideCoordinates() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station()));
        when(facilityRepository.searchActive(1L, null, "exit")).thenReturn(List.of());
        when(exitDetailRepository.findAllByFacilityIdIn(List.of())).thenReturn(List.of());

        assertThatThrownBy(() -> nearestExitService.findNearestExit(request()))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.EXIT_LOCATION_NOT_FOUND));
    }

    /**
     * 엘리베이터 우선 경로의 도착 출구.
     *
     * <p>가장 가까운 출구가 계단으로만 닿는 곳이면 그것을 고르면 안 된다. 그 출구를 도착점으로
     * 경로를 조회하면 {@code NO_ACCESSIBLE_ROUTE} 가 나와, 갈 수 있는 출구가 있는데도 없다고
     * 안내하게 된다.
     */
    @Test
    void findNearestExitKeepsOnlyAccessibleExitsWhenAsked() {
        Facility closerStairOnlyExit = exitFacility(10L, "1번 출구", false);
        Facility fartherAccessibleExit = exitFacility(50L, "3번 출구", true);

        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station()));
        when(facilityRepository.searchActive(1L, null, "exit"))
                .thenReturn(List.of(closerStairOnlyExit, fartherAccessibleExit));
        // 계단 전용 출구는 후보에서 빠지므로 상세 조회에도 들어가지 않는다.
        when(exitDetailRepository.findAllByFacilityIdIn(List.of(50L))).thenReturn(List.of(
                ExitDetail.create(
                        50L,
                        "3",
                        new BigDecimal("37.400000"),
                        new BigDecimal("127.000000"),
                        null,
                        null
                )
        ));

        NearestExitResponse response = nearestExitService.findNearestExit(accessibleOnlyRequest());

        assertThat(response.exitFacilityId()).isEqualTo(50L);
        assertThat(response.exitNumber()).isEqualTo("3");
    }

    /** 계단 없이 나갈 수 있는 출구가 하나도 없는 역. 없다고 답하는 것이 맞는 결과다. */
    @Test
    void findNearestExitThrowsWhenNoAccessibleExitExists() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station()));
        when(facilityRepository.searchActive(1L, null, "exit"))
                .thenReturn(List.of(exitFacility(10L, "1번 출구", false)));
        when(exitDetailRepository.findAllByFacilityIdIn(List.of())).thenReturn(List.of());

        assertThatThrownBy(() -> nearestExitService.findNearestExit(accessibleOnlyRequest()))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.EXIT_LOCATION_NOT_FOUND));
    }

    private NearestExitRequest request() {
        return new NearestExitRequest(
                1L,
                new BigDecimal("37.500029"),
                new BigDecimal("127.036431"),
                null
        );
    }

    private NearestExitRequest accessibleOnlyRequest() {
        return new NearestExitRequest(
                1L,
                new BigDecimal("37.500029"),
                new BigDecimal("127.036431"),
                true
        );
    }

    private Station station() {
        return Station.create(
                "역삼역",
                "Yeoksam Station",
                "2호선",
                new BigDecimal("37.500700"),
                new BigDecimal("127.036500")
        );
    }

    private Facility exitFacility(Long id, String name) {
        return exitFacility(id, name, true);
    }

    private Facility exitFacility(Long id, String name, boolean accessible) {
        Facility facility = Facility.create(
                1L,
                1L,
                "exit",
                name,
                null,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                null,
                accessible
        );
        ReflectionTestUtils.setField(facility, "id", id);
        return facility;
    }
}
