package com.pingo.backend.usersession.dto.request;

import com.pingo.backend.usersession.domain.Language;

import java.math.BigDecimal;

public record UserSessionUpdateRequest(
   Language language,
   Long selectedStationId,
   Long currentNodeId,
   String destinationType,
   Long destinationId,
   BigDecimal lastGpsLatitude,
   BigDecimal lastGpsLongitude
) {}
