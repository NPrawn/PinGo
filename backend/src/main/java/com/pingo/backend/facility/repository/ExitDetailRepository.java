package com.pingo.backend.facility.repository;

import com.pingo.backend.facility.domain.ExitDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ExitDetailRepository extends JpaRepository<ExitDetail, Long> {

    Optional<ExitDetail> findByFacilityId(Long facilityId);

    void deleteByFacilityId(Long facilityId);
}
