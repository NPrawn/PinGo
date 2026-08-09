package com.pingo.backend.consultation.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "consultation_transcript")
public class ConsultationTranscript {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "transcript_id")
    private Long id;

    @Column(nullable = false, length = 64)
    private String consultationId;

    @Column(nullable = false)
    private int seq;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TranscriptSpeaker speaker;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String translatedContent;

    protected ConsultationTranscript() {
    }

    private ConsultationTranscript(String consultationId, int seq, TranscriptSpeaker speaker,
                                   String content, String translatedContent) {
        this.consultationId = consultationId;
        this.seq = seq;
        this.speaker = speaker;
        this.content = content;
        this.translatedContent = translatedContent;
    }

    public static ConsultationTranscript of(String consultationId, int seq,
                                            TranscriptSpeaker speaker, String content) {
        return of(consultationId, seq, speaker, content, null);
    }

    public static ConsultationTranscript of(String consultationId, int seq,
                                            TranscriptSpeaker speaker, String content,
                                            String translatedContent) {
        return new ConsultationTranscript(consultationId, seq, speaker, content, translatedContent);
    }

    public Long getId() { return id; }
    public String getConsultationId() { return consultationId; }
    public int getSeq() { return seq; }
    public TranscriptSpeaker getSpeaker() { return speaker; }
    public String getContent() { return content; }
    public String getTranslatedContent() { return translatedContent; }
}
