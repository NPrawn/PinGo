package com.pingo.backend.station.repository;

import com.pingo.backend.station.domain.StationFloor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StationFloorRepository extends JpaRepository<StationFloor, Long> {

    List<StationFloor> findAllByStationIdOrderByFloorOrderAsc(Long stationId);

    boolean existsByStationIdAndFloorCode(
            Long stationId,
            String floorCode
    );

    boolean existsByStationIdAndFloorCodeAndIdNot(
            Long stationId,
            String floorCode,
            Long floorId
    );
}