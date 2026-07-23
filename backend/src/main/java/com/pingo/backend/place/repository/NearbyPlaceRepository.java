package com.pingo.backend.place.repository;

import com.pingo.backend.place.domain.NearbyPlace;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface NearbyPlaceRepository extends JpaRepository<NearbyPlace, Long> {

    Optional<NearbyPlace> findByIdAndActiveTrue(Long id);

    @Query("""
            SELECT p FROM NearbyPlace p
            WHERE p.active = true
              AND p.stationId = :stationId
              AND (LOWER(p.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(p.nameEn) LIKE LOWER(CONCAT('%', :keyword, '%')))
            ORDER BY p.nameKo ASC
            """)
    List<NearbyPlace> searchActiveByKeyword(@Param("stationId") Long stationId, @Param("keyword") String keyword);
}
