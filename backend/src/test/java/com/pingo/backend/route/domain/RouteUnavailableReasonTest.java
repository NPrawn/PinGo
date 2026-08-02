package com.pingo.backend.route.domain;

import com.pingo.backend.usersession.domain.Language;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RouteUnavailableReasonTest {

    @Test
    @DisplayName("요청 언어에 맞는 문구를 돌려준다")
    void returnsMessageForRequestedLanguage() {
        assertThat(RouteUnavailableReason.NO_ROUTE.messageFor(Language.KO))
                .isEqualTo("출발지에서 도착지까지 연결된 경로가 없습니다.");
        assertThat(RouteUnavailableReason.NO_ROUTE.messageFor(Language.EN))
                .isEqualTo("There is no connected route to the destination.");
    }

    @Test
    @DisplayName("문구가 없는 언어는 영어로 떨어진다")
    void fallsBackToEnglishForUnsupportedLanguages() {
        // FR-U-001 이 요구하는 것은 한·영 둘이다. JA·ZH 는 FR-L-001 에서 채운다.
        String english = RouteUnavailableReason.NO_ACCESSIBLE_ROUTE.messageFor(Language.EN);

        assertThat(RouteUnavailableReason.NO_ACCESSIBLE_ROUTE.messageFor(Language.JA)).isEqualTo(english);
        assertThat(RouteUnavailableReason.NO_ACCESSIBLE_ROUTE.messageFor(Language.ZH)).isEqualTo(english);
        assertThat(RouteUnavailableReason.NO_ACCESSIBLE_ROUTE.messageFor(null)).isEqualTo(english);
    }

    @Test
    @DisplayName("모든 사유가 두 언어 문구를 갖는다")
    void everyReasonHasBothLanguages() {
        // 사유를 추가하면서 한쪽 문구를 빠뜨리면 여기서 걸린다.
        for (RouteUnavailableReason reason : RouteUnavailableReason.values()) {
            assertThat(reason.messageFor(Language.KO)).isNotBlank();
            assertThat(reason.messageFor(Language.EN)).isNotBlank();
            assertThat(reason.messageFor(Language.KO))
                    .as("%s 의 한국어와 영어 문구가 같다", reason)
                    .isNotEqualTo(reason.messageFor(Language.EN));
        }
    }
}
