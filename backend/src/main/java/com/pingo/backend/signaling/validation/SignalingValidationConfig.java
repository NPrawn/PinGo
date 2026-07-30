package com.pingo.backend.signaling.validation;

import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SignalingValidationConfig {

    @Bean
    public SignalingSessionIdParser signalingSessionIdParser() {
        return new SignalingSessionIdParser();
    }

    @Bean
    @ConditionalOnMissingBean(SignalingSessionValidator.class)
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
