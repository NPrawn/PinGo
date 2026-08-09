package com.pingo.backend.floormap.repository;

import com.pingo.backend.floormap.domain.FloorMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FloorMapRepository extends JpaRepository<FloorMap, Long> {

    List<FloorMap> findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(Long floorId);

    List<FloorMap> findAllByFloorIdInAndActiveTrue(Collection<Long> floorIds);

    long countByFloorId(Long floorId);
}
