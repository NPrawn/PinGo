package com.pingo.backend.floormap.service;

import com.pingo.backend.global.config.FileStorageProperties;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileStorageServiceTest {

    @Test
    void storeWritesFileAndReturnsRelativeUrl(@TempDir Path tempDir) throws Exception {
        FileStorageService service = new FileStorageService(
                new FileStorageProperties(tempDir.toString(), "/uploads"));
        MockMultipartFile file = new MockMultipartFile("mapFile", "b1.png", "image/png", "hello".getBytes());

        String url = service.store(file, "maps");

        assertThat(url).startsWith("/uploads/maps/").endsWith(".png");
        String storedName = url.substring("/uploads/maps/".length());
        Path storedPath = tempDir.resolve("maps").resolve(storedName);
        assertThat(Files.exists(storedPath)).isTrue();
        assertThat(Files.readString(storedPath)).isEqualTo("hello");
    }

    @Test
    void storeThrowsForEmptyFile(@TempDir Path tempDir) {
        FileStorageService service = new FileStorageService(
                new FileStorageProperties(tempDir.toString(), "/uploads"));
        MockMultipartFile emptyFile = new MockMultipartFile("mapFile", "b1.png", "image/png", new byte[0]);

        assertThatThrownBy(() -> service.store(emptyFile, "maps"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_MAP_FILE));
    }

    @Test
    void storeThrowsForNullFile(@TempDir Path tempDir) {
        FileStorageService service = new FileStorageService(
                new FileStorageProperties(tempDir.toString(), "/uploads"));

        assertThatThrownBy(() -> service.store(null, "maps"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_MAP_FILE));
    }
}
