package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationTranscript;
import com.pingo.backend.consultation.domain.TranscriptSpeaker;

public record TranscriptSegmentResponse(
        int seq,
        TranscriptSpeaker speaker,
        String content
) {
    public static TranscriptSegmentResponse from(ConsultationTranscript transcript) {
        return new TranscriptSegmentResponse(
                transcript.getSeq(),
                transcript.getSpeaker(),
                transcript.getContent()
        );
    }
}