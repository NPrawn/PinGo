package com.pingo.backend.transcription.service;

import com.pingo.backend.transcription.dto.TranscriptionRequest;
import com.pingo.backend.transcription.dto.TranscriptionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConsultationTranscriptionService {

    private final Transcriber transcriber;

    /**
     * 받아쓰지 못한 조각은 빈 글로 돌려준다.
     *
     * 오류로 돌려주면 화면이 재시도를 하게 되는데, 말소리가 없어 비어 있는 조각은 몇 번을 다시
     * 보내도 결과가 같다. 헛된 왕복만 늘고 그동안 다음 발화가 밀린다.
     */
    public TranscriptionResponse transcribe(String consultationId, TranscriptionRequest request) {
        String text = transcriber.transcribe(request.audio(), request.mimeType(), request.language());

        /*
         * 무엇이 얼마나 들어왔는지 남긴다.
         *
         * 자막이 통째로 비는 장애를 상담이 끝난 뒤에야 알게 되는 일이 있었다. 조각 크기와
         * 결과 길이를 함께 남겨 두면, 소리가 아예 안 들어온 것인지 모델이 못 알아들은 것인지
         * 로그만으로 갈린다.
         */
        log.info("Transcribed consultation audio. consultationId={}, mimeType={}, base64Length={}, textLength={}",
                consultationId,
                request.mimeType(),
                request.audio().length(),
                text == null ? 0 : text.length());

        return text == null ? TranscriptionResponse.empty() : TranscriptionResponse.of(text);
    }
}
