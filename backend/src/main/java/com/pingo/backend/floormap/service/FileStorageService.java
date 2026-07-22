package com.pingo.backend.floormap.service;

import com.pingo.backend.global.config.FileStorageProperties;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

/**
 * MultipartFile 을 서버 로컬 디렉토리에 저장하고, DB 에 보관할 상대 URL 을 반환한다.
 * 물리 저장 경로는 절대 경로로 다루되, 반환 URL 은 항상 urlPrefix 기준 상대 경로다.
 */
@Service
@RequiredArgsConstructor
public class FileStorageService {

    private final FileStorageProperties properties;

    public String store(MultipartFile file, String subDirectory) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_MAP_FILE);
        }

        String storedFileName = UUID.randomUUID() + resolveExtension(file.getOriginalFilename());

        try {
            Path directory = Path.of(properties.uploadDir(), subDirectory).toAbsolutePath().normalize();
            Files.createDirectories(directory);
            file.transferTo(directory.resolve(storedFileName));
        } catch (IOException exception) {
            throw new BusinessException(ErrorCode.FILE_STORAGE_FAILED);
        }

        return properties.urlPrefix() + "/" + subDirectory + "/" + storedFileName;
    }

    private String resolveExtension(String originalFileName) {
        if (originalFileName == null) {
            return "";
        }

        int dotIndex = originalFileName.lastIndexOf('.');
        if (dotIndex < 0) {
            return "";
        }

        String extension = originalFileName.substring(dotIndex).toLowerCase(Locale.ROOT);
        return extension.matches("\\.[a-z0-9]{1,10}") ? extension : "";
    }
}
