package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationTranscript;
import com.pingo.backend.consultation.event.TranscriptSavedEvent;
import com.pingo.backend.consultation.repository.ConsultationTranscriptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConsultationSummaryProcessor {

    private final ConsultationTranscriptRepository consultationTranscriptRepository;
    private final ConsultationSummaryGenerator summaryGenerator;
    private final ConsultationSummaryUpdater summaryUpdater;

    @Async
    @TransactionalEventListener
    public void handle(TranscriptSavedEvent event) {
        String consultationId = event.consultationId();

        // 짧은 읽기 트랜잭션 — 리포지토리 호출 단위로 커넥션을 잡고 바로 반납한다
        List<ConsultationTranscript> transcripts =
                consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(consultationId);

        if (transcripts.isEmpty()) {
            log.warn("전문이 비어 있어 요약을 생성하지 않습니다. consultationId={}", consultationId);
            summaryUpdater.fail(consultationId);
            return;
        }

        try {
            // 외부 API 호출은 트랜잭션 밖에서 수행한다
            String summaryText = summaryGenerator.generate(transcripts);
            summaryUpdater.complete(consultationId, summaryText);
            log.info("상담 요약 생성 완료. consultationId={}", consultationId);
        } catch (Exception e) {
            summaryUpdater.fail(consultationId);
            log.error("상담 요약 생성 실패. consultationId={}", consultationId, e);
        }
    }
}