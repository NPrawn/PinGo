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

    @Query("""
            SELECT f FROM Facility f
            WHERE f.active = true
              AND f.stationId = :stationId
              AND (LOWER(f.nameKo) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(f.nameEn) LIKE LOWER(CONCAT('%', :keyword, '%')))
            ORDER BY f.floorId ASC, f.id ASC
            """)
    List<Facility> searchActiveByKeyword(@Param("stationId") Long stationId, @Param("keyword") String keyword);

    /**
     * 특정 경로 노드에 연결된 활성 시설. {@code linked_node_id} 에 외래키 인덱스가 있어 단건으로 좁혀진다.
     *
     * <p>한 노드에 시설이 여럿 붙을 수 있어 리스트로 돌려준다. 호출부가 하나만 쓰더라도
     * {@code ORDER BY f.id ASC} 로 순서가 정해져 있어 매번 같은 시설이 뽑힌다.
     */
    @Query("""
            SELECT f FROM Facility f
            WHERE f.active = true
              AND f.stationId = :stationId
              AND f.floorId = :floorId
              AND f.linkedNodeId = :nodeId
            ORDER BY f.id ASC
            """)
    List<Facility> findActiveByLinkedNodeId(
            @Param("stationId") Long stationId,
            @Param("floorId") Long floorId,
            @Param("nodeId") Long nodeId
    );

    /**
     * 이 노드를 도착점으로 갖는 시설의 <b>접근 경로용 도착 노드</b>. 없으면 빈 리스트다.
     *
     * <p>층을 조건에 넣지 않는다. 노드 하나는 한 층에만 있으므로 층을 알 필요가 없고, 부르는
     * 쪽({@code IndoorRouteService})은 목적지 노드만 들고 있다.
     *
     * <p>한 노드에 시설이 여럿 붙을 수 있어 리스트로 돌려준다 — {@code findActiveByLinkedNodeId}
     * 와 같은 이유다. {@code ORDER BY f.id ASC} 로 매번 같은 시설이 뽑힌다.
     */
    @Query("""
            SELECT f.accessibleNodeId FROM Facility f
            WHERE f.active = true
              AND f.stationId = :stationId
              AND f.linkedNodeId = :nodeId
              AND f.accessibleNodeId IS NOT NULL
            ORDER BY f.id ASC
            """)
    List<Long> findAccessibleNodeIds(@Param("stationId") Long stationId, @Param("nodeId") Long nodeId);
}
