package com.pingo.backend.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 업로드 파일의 물리 저장 위치(uploadDir)와 공개 접근 경로(urlPrefix)를 분리해 관리한다.
 * DB에는 절대 경로가 아니라 urlPrefix 기준 상대 URL만 저장하여 배포 도메인 변경에 영향받지 않도록 한다.
 */
@ConfigurationProperties(prefix = "app.file")
public record FileStorageProperties(
        String uploadDir,
        String urlPrefix
) {

    public FileStorageProperties {
        if (uploadDir == null || uploadDir.isBlank()) {
            uploadDir = "uploads";
        }
        if (urlPrefix == null || urlPrefix.isBlank()) {
            urlPrefix = "/uploads";
        }
    }
}
