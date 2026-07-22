package com.pingo.backend.facility.repository;

import com.pingo.backend.facility.domain.Facility;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FacilityRepository extends JpaRepository<Facility, Long> {

    Optional<Facility> findByIdAndActiveTrue(Long id);

    @Query("""
            SELECT f FROM Facility f
            WHERE f.active = true
              AND f.stationId = :stationId
              AND (:floorId IS NULL OR f.floorId = :floorId)
              AND (:facilityType IS NULL OR f.facilityType = :facilityType)
            ORDER BY f.floorId ASC, f.id ASC
            """)
    List<Facility> searchActive(
            @Param("stationId") Long stationId,
            @Param("floorId") Long floorId,
            @Param("facilityType") String facilityType
    );
}
