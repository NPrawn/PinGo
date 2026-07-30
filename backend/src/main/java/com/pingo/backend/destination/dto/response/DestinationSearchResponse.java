package com.pingo.backend.destination.dto.response;

import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.place.domain.NearbyPlace;
import java.math.BigDecimal;

public record DestinationSearchResponse(
        String destinationType,
        Long destinationId,
        String nameKo,
        String nameEn,
        String category,
        BigDecimal latitude,
        BigDecimal longitude,
        String address
) {

    public static DestinationSearchResponse fromFacility(Facility facility) {
        return new DestinationSearchResponse(
                "facility",
                facility.getId(),
                facility.getNameKo(),
                facility.getNameEn(),
                facility.getFacilityType(),
                null,
                null,
                null
        );
    }

    public static DestinationSearchResponse fromPlace(NearbyPlace place) {
        return new DestinationSearchResponse(
                "place",
                place.getId(),
                place.getNameKo(),
                place.getNameEn(),
                place.getCategory(),
                place.getLatitude(),
                place.getLongitude(),
                place.getAddress()
        );
    }
}
