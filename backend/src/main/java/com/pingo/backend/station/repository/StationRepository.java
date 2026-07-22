package com.pingo.backend.station.repository;

import com.pingo.backend.station.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, Long> {

    List<Station> findAllByActiveTrueOrderByNameKoAsc();

    Optional<Station> findByIdAndActiveTrue(Long id);

    @Query("""
            SELECT s FROM Station s
            WHERE s.active = true
              AND (LOWER(s.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(s.nameEn) LIKE LOWER(CONCAT('%', :keyword, '%')))
            ORDER BY s.nameKo ASC
            """)
    List<Station> searchActiveByKeyword(@Param("keyword") String keyword);
}
