package com.pingo.backend.transcription.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WhisperTranscriberTest {

    private static MockMultipartFile audio() {
        return new MockMultipartFile(
                "file",
                "segment.webm",
                "audio/webm;codecs=opus",
                "clear-audio-data".getBytes(StandardCharsets.UTF_8)
        );
    }

    @Test
    void dropsTheNoSpeechMarker() {
        assertThat(WhisperTranscriber.sanitizeTranscription("<no-speech>")).isNull();
        assertThat(WhisperTranscriber.sanitizeTranscription("  <NO-SPEECH>  ")).isNull();
    }

    @Test
    void keepsRealSpeech() {
        assertThat(WhisperTranscriber.sanitizeTranscription("3번 출구로 가려면요?"))
                .isEqualTo("3번 출구로 가려면요?");
    }

    @Test
    void treatsBlankAsNothing() {
        assertThat(WhisperTranscriber.sanitizeTranscription("   ")).isNull();
        assertThat(WhisperTranscriber.sanitizeTranscription(null)).isNull();
    }

    @Test
    void dropsRunawayWordRepetition() {
        assertThat(WhisperTranscriber.sanitizeTranscription("I got a gun, ah ah ah ah ah ah ah ah ah ah"))
                .isNull();
    }

    @Test
    void dropsOnlyTheRunawayLineAndKeepsOtherSpeech() {
        assertThat(WhisperTranscriber.sanitizeTranscription(
                "3번 출구로 가려면요?\nah ah ah ah ah ah ah ah ah ah"))
                .isEqualTo("3번 출구로 가려면요?");
    }

    @Test
    void collapsesRepeatedLines() {
        assertThat(WhisperTranscriber.sanitizeTranscription("3번 출구요\n3번 출구요\n3번 출구요"))
                .isEqualTo("3번 출구요");
    }

    @Test
    void keepsShortNaturalRepetition() {
        assertThat(WhisperTranscriber.sanitizeTranscription("네 네 네 네 네 알겠습니다"))
                .isEqualTo("네 네 네 네 네 알겠습니다");
    }

    @Test
    void normalizesBrowserLanguageTags() {
        assertThat(WhisperTranscriber.normalizeLanguage("ko-KR")).isEqualTo("ko");
        assertThat(WhisperTranscriber.normalizeLanguage("en_US")).isEqualTo("en");
        assertThat(WhisperTranscriber.normalizeLanguage("auto")).isNull();
    }

    /** GMS 앞단 Cloudflare가 거절하는 chunked multipart 대신 전체 길이가 있는 요청을 보낸다. */
    @Test
    void buffersMultipartRequestAndSendsContentLength() throws IOException {
        AtomicReference<String> contentLength = new AtomicReference<>();
        AtomicReference<String> transferEncoding = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = testServer(exchange -> {
            contentLength.set(exchange.getRequestHeaders().getFirst("Content-Length"));
            transferEncoding.set(exchange.getRequestHeaders().getFirst("Transfer-Encoding"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1));
            byte[] response = "{\"text\":\"하나 둘 셋\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });

        try {
            WhisperTranscriber transcriber = transcriberFor(server);

            assertThat(transcriber.transcribe(audio(), "ko")).isEqualTo("하나 둘 셋");
            assertThat(contentLength.get()).isNotBlank();
            assertThat(transferEncoding.get()).isNull();
            assertThat(requestBody.get()).contains("name=\"file\"", "segment.webm", "whisper-1");
        } finally {
            server.stop(0);
        }
    }

    /** 외부 API 실패를 무음처럼 빈 성공 응답으로 바꾸지 않는다. */
    @Test
    void exposesExternalTranscriptionFailure() throws IOException {
        HttpServer server = testServer(exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(400, -1);
            exchange.close();
        });

        try {
            WhisperTranscriber transcriber = transcriberFor(server);

            assertThatThrownBy(() -> transcriber.transcribe(audio(), "ko"))
                    .isInstanceOfSatisfying(BusinessException.class, exception ->
                            assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.TRANSCRIPTION_SERVICE_FAILED));
        } finally {
            server.stop(0);
        }
    }

    private static HttpServer testServer(com.sun.net.httpserver.HttpHandler handler) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        server.createContext("/audio/transcriptions", handler);
        server.start();
        return server;
    }

    private static WhisperTranscriber transcriberFor(HttpServer server) {
        return new WhisperTranscriber(
                "http://127.0.0.1:" + server.getAddress().getPort(),
                "test-key",
                "whisper-1",
                5_000
        );
    }
}
