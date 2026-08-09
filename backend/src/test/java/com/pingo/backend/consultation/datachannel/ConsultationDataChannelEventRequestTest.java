package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.request.ConsultationDataChannelEventRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ConsultationDataChannelEventRequestTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validRequestHasNoViolation() {
        ConsultationDataChannelEventRequest request = new ConsultationDataChannelEventRequest(
                ConsultationDataChannelEventType.ARROW_POINTED,
                null
        );

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void typeIsRequired() {
        ConsultationDataChannelEventRequest request = new ConsultationDataChannelEventRequest(
                null,
                null
        );

        assertThat(validator.validate(request)).isNotEmpty();
    }
}