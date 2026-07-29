package com.pingo.backend.usersession.dto.request;

import com.pingo.backend.usersession.domain.Language;

public record UserSessionCreateRequest (
        Language language
){ }
