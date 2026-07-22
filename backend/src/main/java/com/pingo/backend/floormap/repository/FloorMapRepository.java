package com.pingo.backend.floormap.repository;

import com.pingo.backend.floormap.domain.FloorMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FloorMapRepository extends JpaRepository<FloorMap, Long> {

    List<FloorMap> findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(Long floorId);

    long countByFloorId(Long floorId);
}
