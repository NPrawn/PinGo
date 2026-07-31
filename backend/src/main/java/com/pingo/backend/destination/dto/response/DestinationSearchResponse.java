package com.pingo.backend.destination.dto.response;

import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.externalmap.client.KakaoPlaceSearchResult;
import com.pingo.backend.place.domain.NearbyPlace;
import java.math.BigDecimal;

public record DestinationSearchResponse(
        String destinationType,
        Long destinationId,
        String nameKo,
        String nameEn,
        String category,
        String provider,
        String externalId,
        String address,
        BigDecimal latitude,
        BigDecimal longitude,
        Long distanceMeters
) {

    public DestinationSearchResponse(
            String destinationType,
            Long destinationId,
            String nameKo,
            String nameEn,
            String category
    ) {
        this(destinationType, destinationId, nameKo, nameEn, category, null, null, null, null, null, null);
    }

    public static DestinationSearchResponse fromFacility(Facility facility) {
        return new DestinationSearchResponse(
                "facility",
                facility.getId(),
                facility.getNameKo(),
                facility.getNameEn(),
                facility.getFacilityType()
        );
    }

    public static DestinationSearchResponse fromPlace(NearbyPlace place) {
        return new DestinationSearchResponse(
                "place",
                place.getId(),
                place.getNameKo(),
                place.getNameEn(),
                place.getCategory(),
                null,
                null,
                place.getAddress(),
                place.getLatitude(),
                place.getLongitude(),
                null
        );
    }

    public static DestinationSearchResponse fromKakaoPlace(KakaoPlaceSearchResult place) {
        return new DestinationSearchResponse(
                "external_place",
                null,
                place.name(),
                null,
                place.category(),
                "kakao",
                place.placeId(),
                place.address(),
                place.latitude(),
                place.longitude(),
                place.distanceMeters()
        );
    }
}
