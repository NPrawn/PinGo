package com.pingo.backend.route.repository;

import com.pingo.backend.route.domain.RouteNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RouteNodeRepository extends JpaRepository<RouteNode, Long> {

    @Query("""
            SELECT n FROM RouteNode n
            WHERE n.stationId = :stationId
              AND (:floorId IS NULL OR n.floorId = :floorId)
            ORDER BY n.floorId ASC, n.id ASC
            """)
    List<RouteNode> search(@Param("stationId") Long stationId, @Param("floorId") Long floorId);
}
