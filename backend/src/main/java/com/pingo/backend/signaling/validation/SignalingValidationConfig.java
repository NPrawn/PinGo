package com.pingo.backend.signaling.validation;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SignalingValidationConfig {

    @Bean
    @ConditionalOnMissingBean(SignalingSessionValidator.class)
    public SignalingSessionValidator signalingSessionValidator() {
        return new NoopSignalingSessionValidator();
    }
}
