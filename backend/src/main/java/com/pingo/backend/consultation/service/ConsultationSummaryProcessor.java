package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.domain.ConsultationTranscript;
import com.pingo.backend.consultation.event.TranscriptSavedEvent;
import com.pingo.backend.consultation.repository.ConsultationSummaryRepository;
import com.pingo.backend.consultation.repository.ConsultationTranscriptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConsultationSummaryProcessor {

    private final ConsultationSummaryRepository consultationSummaryRepository;
    private final ConsultationTranscriptRepository consultationTranscriptRepository;
    private final ConsultationSummaryGenerator summaryGenerator;

    @Async
    @TransactionalEventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handle(TranscriptSavedEvent event) {
        String consultationId = event.consultationId();

        ConsultationSummary summary = consultationSummaryRepository
                .findByConsultationId(consultationId)
                .orElse(null);

        if (summary == null) {
            log.warn("요약 대상을 찾을 수 없습니다. consultationId={}", consultationId);
            return;
        }

        List<ConsultationTranscript> transcripts =
                consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(consultationId);

        if (transcripts.isEmpty()) {
            log.warn("전문이 비어 있어 요약을 생성하지 않습니다. consultationId={}", consultationId);
            summary.fail();
            return;
        }

        try {
            summary.complete(summaryGenerator.generate(transcripts));
            log.info("상담 요약 생성 완료. consultationId={}", consultationId);
        } catch (Exception e) {
            summary.fail();
            log.error("상담 요약 생성 실패. consultationId={}", consultationId, e);
        }
    }
}