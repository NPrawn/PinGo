package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationTranscript;

import java.util.List;

public interface ConsultationSummaryGenerator {

    /**
     * 상담 전문으로부터 한 줄 요약을 생성한다.
     *
     * @return 요약 문장. 생성 실패 시 예외를 던진다.
     */
    String generate(List<ConsultationTranscript> transcripts);
}
