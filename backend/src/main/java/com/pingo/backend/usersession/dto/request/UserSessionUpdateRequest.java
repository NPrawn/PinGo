package com.pingo.backend.usersession.dto.request;

import com.pingo.backend.usersession.domain.Language;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;

public record UserSessionUpdateRequest(
   Language language,
   Long selectedStationId,
   Long currentNodeId,
   @Pattern(regexp = "facility|place|shared_location")
   String destinationType,
   Long destinationId,
   BigDecimal lastGpsLatitude,
   BigDecimal lastGpsLongitude
) {}
