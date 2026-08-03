package com.pingo.backend.consultation.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Entity
@Table(name = "consultation_summary")
public class ConsultationSummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "summary_id")
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String consultationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SummaryStatus status;

    @Column(length = 500)
    private String summaryText;

    @Column(length = 200)
    private String startLocationLabel;

    private Long guidedExitFacilityId;

    @Column(length = 100)
    private String guidedExitLabel;

    @Column(length = 20)
    private String routeType;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    protected ConsultationSummary() {
    }

    private ConsultationSummary(String consultationId, String startLocationLabel,
                                Long guidedExitFacilityId, String guidedExitLabel, String routeType) {
        this.consultationId = consultationId;
        this.status = SummaryStatus.PENDING;
        this.startLocationLabel = startLocationLabel;
        this.guidedExitFacilityId = guidedExitFacilityId;
        this.guidedExitLabel = guidedExitLabel;
        this.routeType = routeType;
        this.createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public static ConsultationSummary pending(String consultationId, String startLocationLabel,
                                              Long guidedExitFacilityId, String guidedExitLabel,
                                              String routeType) {
        return new ConsultationSummary(consultationId, startLocationLabel,
                guidedExitFacilityId, guidedExitLabel, routeType);
    }

    public void complete(String summaryText) {
        this.summaryText = summaryText;
        this.status = SummaryStatus.COMPLETED;
        this.completedAt = LocalDateTime.now(ZoneOffset.UTC);
    }

    public void fail() {
        this.status = SummaryStatus.FAILED;
        this.completedAt = null;
    }

    public void retry() {
        this.status = SummaryStatus.PENDING;
    }

    public boolean isRetryable() {
        return this.status == SummaryStatus.FAILED;
    }

    public Long getId() { return id; }
    public String getConsultationId() { return consultationId; }
    public SummaryStatus getStatus() { return status; }
    public String getSummaryText() { return summaryText; }
    public String getStartLocationLabel() { return startLocationLabel; }
    public Long getGuidedExitFacilityId() { return guidedExitFacilityId; }
    public String getGuidedExitLabel() { return guidedExitLabel; }
    public String getRouteType() { return routeType; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
}