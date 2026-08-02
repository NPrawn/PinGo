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

    protected ConsultationTranscript() {
    }

    private ConsultationTranscript(String consultationId, int seq, TranscriptSpeaker speaker, String content) {
        this.consultationId = consultationId;
        this.seq = seq;
        this.speaker = speaker;
        this.content = content;
    }

    public static ConsultationTranscript of(String consultationId, int seq,
                                            TranscriptSpeaker speaker, String content) {
        return new ConsultationTranscript(consultationId, seq, speaker, content);
    }

    public Long getId() { return id; }
    public String getConsultationId() { return consultationId; }
    public int getSeq() { return seq; }
    public TranscriptSpeaker getSpeaker() { return speaker; }
    public String getContent() { return content; }
}