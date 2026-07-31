package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.domain.CounselorStatus;
import com.pingo.backend.auth.dto.request.AccountUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.dto.response.AccountListResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AdminAccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private StationRepository stationRepository;

    @InjectMocks
    private AdminAccountService adminAccountService;

    @Test
    @DisplayName("목록조회 시 저장소가 반환한 계정들을 응답 DTO로 매핑한다")
    void listCounselors_mapsToResponse() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);

        given(accountRepository.findCounselors(AccountType.COUNSELOR, 1L, true))
                .willReturn(List.of(counselor));

        List<AccountListResponse> result = adminAccountService.listCounselors(1L, true);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).loginId()).isEqualTo("counselor01");
        assertThat(result.get(0).stationId()).isEqualTo(1L);
        assertThat(result.get(0).isActive()).isFalse();
    }

    @Test
    @DisplayName("상세조회 성공")
    void getCounselor_success() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        AccountDetailResponse response = adminAccountService.getCounselor(1L);

        assertThat(response.loginId()).isEqualTo("counselor01");
        assertThat(response.name()).isEqualTo("김상담");
    }

    @Test
    @DisplayName("존재하지 않는 계정 상세조회 시 ACCOUNT_NOT_FOUND")
    void getCounselor_notFound_throws() {
        given(accountRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminAccountService.getCounselor(999L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    @DisplayName("대상 계정이 관리자(ADMIN) 타입이면 상세조회에서도 ACCOUNT_NOT_FOUND로 처리한다")
    void getCounselor_targetIsAdmin_throwsAccountNotFound() {
        Account admin = mock(Account.class);
        given(admin.getAccountType()).willReturn(AccountType.ADMIN);
        given(accountRepository.findById(1L)).willReturn(Optional.of(admin));

        assertThatThrownBy(() -> adminAccountService.getCounselor(1L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    @DisplayName("담당역 재배정이 정상 반영된다")
    void updateCounselor_changesStation() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));
        given(stationRepository.findById(2L)).willReturn(Optional.of(mock(Station.class)));

        AccountDetailResponse response = adminAccountService.updateCounselor(1L, new AccountUpdateRequest(2L, null));

        assertThat(response.stationId()).isEqualTo(2L);
        assertThat(response.isActive()).isFalse();
    }

    @Test
    @DisplayName("isActive=true를 보내면 승인(approve) 처리된다")
    void updateCounselor_approves() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        AccountDetailResponse response = adminAccountService.updateCounselor(1L, new AccountUpdateRequest(null, true));

        assertThat(response.isActive()).isTrue();
        assertThat(response.status()).isEqualTo(CounselorStatus.AVAILABLE);
    }

    @Test
    @DisplayName("isActive=false를 보내면 비활성화 처리된다")
    void updateCounselor_deactivatesViaIsActiveFalse() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);
        counselor.approve();
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        AccountDetailResponse response = adminAccountService.updateCounselor(1L, new AccountUpdateRequest(null, false));

        assertThat(response.isActive()).isFalse();
    }

    @Test
    @DisplayName("존재하지 않는 역으로 재배정하면 STATION_NOT_FOUND, 기존 담당역은 유지된다")
    void updateCounselor_stationNotFound_throws() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));
        given(stationRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminAccountService.updateCounselor(1L, new AccountUpdateRequest(999L, null)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.STATION_NOT_FOUND);

        assertThat(counselor.getStationId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("존재하지 않는 계정을 수정하려 하면 ACCOUNT_NOT_FOUND, 역 조회는 시도하지 않는다")
    void updateCounselor_accountNotFound_throws() {
        given(accountRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminAccountService.updateCounselor(999L, new AccountUpdateRequest(1L, true)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCOUNT_NOT_FOUND);

        verify(stationRepository, never()).findById(any());
    }

    @Test
    @DisplayName("비활성화 성공")
    void deactivateCounselor_success() {
        Account counselor = Account.signUpCounselor("counselor01", "encoded", "김상담", 1L);
        counselor.approve();
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        adminAccountService.deactivateCounselor(1L);

        assertThat(counselor.isActive()).isFalse();
    }

    @Test
    @DisplayName("존재하지 않는 계정 비활성화 시 ACCOUNT_NOT_FOUND")
    void deactivateCounselor_notFound_throws() {
        given(accountRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> adminAccountService.deactivateCounselor(999L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCOUNT_NOT_FOUND);
    }
}
