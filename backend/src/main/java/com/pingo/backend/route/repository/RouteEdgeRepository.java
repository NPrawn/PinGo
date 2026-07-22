package com.pingo.backend.route.repository;

import com.pingo.backend.route.domain.RouteEdge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RouteEdgeRepository extends JpaRepository<RouteEdge, Long> {

    Optional<RouteEdge> findByIdAndActiveTrue(Long id);

    List<RouteEdge> findAllByStationIdAndActiveTrueOrderByIdAsc(Long stationId);
}
