package com.pingo.backend.place.repository;

import com.pingo.backend.place.domain.PlaceExitRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaceExitRecommendationRepository extends JpaRepository<PlaceExitRecommendation, Long> {

    List<PlaceExitRecommendation> findAllByPlaceIdOrderByPriorityAscIdAsc(Long placeId);
}
