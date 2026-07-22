package com.pingo.backend.global.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

/**
 * 업로드 디렉토리를 urlPrefix 경로로 정적 서빙한다.
 * 운영 환경에서는 동일 디렉토리를 Nginx 가 서빙할 수 있으며, 로컬에서는 애플리케이션이 서빙한다.
 * 정적 리소스의 공개 접근 허용(permitAll) 여부는 SecurityConfig(인증 담당) 에서 관리한다.
 */
@Configuration
@EnableConfigurationProperties(FileStorageProperties.class)
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final FileStorageProperties properties;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = Path.of(properties.uploadDir()).toAbsolutePath().normalize().toUri().toString();

        registry.addResourceHandler(properties.urlPrefix() + "/**")
                .addResourceLocations(location);
    }
}
