package com.pingo.backend.global.config;

import com.pingo.backend.global.security.JwtProvider;
import org.junit.jupiter.api.Test;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SecurityConfigCorsTest {

    @Test
    void corsConfigurationUsesConfiguredAllowedOrigins() {
        SecurityConfig securityConfig = new SecurityConfig(
                mock(JwtProvider.class),
                new ObjectMapper(),
                List.of("http://localhost:5173", " https://jenkins.example.invalid ", "")
        );

        CorsConfigurationSource source = securityConfig.corsConfigurationSource();
        CorsConfiguration apiConfiguration = ((UrlBasedCorsConfigurationSource) source)
                .getCorsConfigurations()
                .get("/api/**");
        CorsConfiguration webSocketConfiguration = ((UrlBasedCorsConfigurationSource) source)
                .getCorsConfigurations()
                .get("/ws/**");

        assertThat(apiConfiguration.getAllowedOrigins())
                .containsExactly("http://localhost:5173", "https://jenkins.example.invalid");
        assertThat(webSocketConfiguration.getAllowedOrigins())
                .containsExactly("http://localhost:5173", "https://jenkins.example.invalid");
    }
}
