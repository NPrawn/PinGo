package com.pingo.backend.signaling.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SignalingSessionIdParserTest {

    private final SignalingSessionIdParser parser = new SignalingSessionIdParser();

    @Test
    void parseConsultationIdReturnsConsultationId() {
        assertThat(parser.parseConsultationId("room_cs_abc123"))
                .contains("cs_abc123");
    }

    @Test
    void parseConsultationIdReturnsEmptyWhenPrefixIsInvalid() {
        assertThat(parser.parseConsultationId("cs_abc123"))
                .isEmpty();
    }

    @Test
    void parseConsultationIdReturnsEmptyWhenConsultationIdIsBlank() {
        assertThat(parser.parseConsultationId("room_"))
                .isEmpty();
    }

    @Test
    void parseConsultationIdReturnsEmptyWhenSignalingSessionIdIsNull() {
        assertThat(parser.parseConsultationId(null))
                .isEmpty();
    }
}
