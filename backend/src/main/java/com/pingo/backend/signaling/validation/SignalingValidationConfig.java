package com.pingo.backend.signaling.validation;

import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SignalingValidationConfig {

    @Bean
    public SignalingSessionIdParser signalingSessionIdParser() {
        return new SignalingSessionIdParser();
    }

    @Bean
    public SignalingSessionValidator signalingSessionValidator(
            ConsultationSessionRepository consultationSessionRepository,
            SignalingSessionIdParser signalingSessionIdParser
    ) {
        return new ConsultationSignalingSessionValidator(
                consultationSessionRepository,
                signalingSessionIdParser
        );
    }
}
