package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.domain.SummaryStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ConsultationListResponseTest {

    @Test
    void 요약이_없으면_상태와_미리보기가_null이다() {
        ConsultationListResponse response = ConsultationListResponse.from(newSession(), null, null);

        assertThat(response.summaryStatus()).isNull();
        assertThat(response.summaryPreview()).isNull();
    }

    @Test
    void 생성_중인_요약은_상태만_반환한다() {
        ConsultationSession session = newSession();
        ConsultationSummary summary = ConsultationSummary.pending(
                session.getConsultationId(),
                "B2 개찰구 앞",
                null,
                "3번 출구",
                "FASTEST"
        );

        ConsultationListResponse response = ConsultationListResponse.from(session, null, summary);

        assertThat(response.summaryStatus()).isEqualTo(SummaryStatus.PENDING);
        assertThat(response.summaryPreview()).isNull();
    }

    @Test
    void 완료된_요약은_160자_미리보기로_반환한다() {
        ConsultationSession session = newSession();
        ConsultationSummary summary = ConsultationSummary.pending(
                session.getConsultationId(),
                "B2 개찰구 앞",
                null,
                "3번 출구",
                "FASTEST"
        );
        summary.complete("가".repeat(200));

        ConsultationListResponse response = ConsultationListResponse.from(session, "김상담", summary);

        assertThat(response.counselorName()).isEqualTo("김상담");
        assertThat(response.summaryStatus()).isEqualTo(SummaryStatus.COMPLETED);
        assertThat(response.summaryPreview()).hasSize(160).endsWith("...");
    }

    private ConsultationSession newSession() {
        return ConsultationSession.create(
                "usr_test",
                1L,
                ProblemType.CANNOT_FIND_EXIT,
                101L,
                "place",
                3L,
                true,
                true,
                true
        );
    }
}
