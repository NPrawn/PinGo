package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.CounselorStatus;
import com.pingo.backend.auth.dto.request.CounselorSelfUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CounselorSelfServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private CounselorSelfService counselorSelfService;

    @Test
    @DisplayName("본인 계정 조회 성공")
    void getMe_success() {
        Account counselor = Account.signUpCounselor("counselor01", "encodedOldPass", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        AccountDetailResponse response = counselorSelfService.getMe(1L);

        assertThat(response.loginId()).isEqualTo("counselor01");
        assertThat(response.name()).isEqualTo("김상담");
    }

    @Test
    @DisplayName("존재하지 않는 계정 조회 시 ACCOUNT_NOT_FOUND")
    void getMe_notFound_throws() {
        given(accountRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> counselorSelfService.getMe(999L))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    @DisplayName("이름 변경이 반영된다")
    void updateMe_changesName() {
        Account counselor = Account.signUpCounselor("counselor01", "encodedOldPass", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        AccountDetailResponse response = counselorSelfService.updateMe(
                1L, new CounselorSelfUpdateRequest("박상담", null, null, null));

        assertThat(response.name()).isEqualTo("박상담");
    }

    @Test
    @DisplayName("상담 가능 상태 변경이 반영된다")
    void updateMe_changesStatus() {
        Account counselor = Account.signUpCounselor("counselor01", "encodedOldPass", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        AccountDetailResponse response = counselorSelfService.updateMe(
                1L, new CounselorSelfUpdateRequest(null, null, null, CounselorStatus.BUSY));

        assertThat(response.status()).isEqualTo(CounselorStatus.BUSY);
    }

    @Test
    @DisplayName("현재 비밀번호가 맞으면 새 비밀번호로 변경된다")
    void updateMe_changesPassword_whenCurrentPasswordMatches() {
        Account counselor = Account.signUpCounselor("counselor01", "encodedOldPass", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));
        given(passwordEncoder.matches("oldPass123!", "encodedOldPass")).willReturn(true);
        given(passwordEncoder.encode("newPass123!")).willReturn("encodedNewPass");

        counselorSelfService.updateMe(
                1L, new CounselorSelfUpdateRequest(null, "oldPass123!", "newPass123!", null));

        assertThat(counselor.getPasswordHash()).isEqualTo("encodedNewPass");
    }

    @Test
    @DisplayName("현재 비밀번호가 틀리면 INVALID_CURRENT_PASSWORD, 비밀번호는 그대로 유지된다")
    void updateMe_wrongCurrentPassword_throwsAndKeepsOldPassword() {
        Account counselor = Account.signUpCounselor("counselor01", "encodedOldPass", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));
        given(passwordEncoder.matches("wrongPass", "encodedOldPass")).willReturn(false);

        assertThatThrownBy(() -> counselorSelfService.updateMe(
                1L, new CounselorSelfUpdateRequest(null, "wrongPass", "newPass123!", null)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CURRENT_PASSWORD);

        assertThat(counselor.getPasswordHash()).isEqualTo("encodedOldPass");
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    @DisplayName("현재 비밀번호 없이 새 비밀번호만 보내면 INVALID_CURRENT_PASSWORD")
    void updateMe_newPasswordWithoutCurrentPassword_throws() {
        Account counselor = Account.signUpCounselor("counselor01", "encodedOldPass", "김상담", 1L);
        given(accountRepository.findById(1L)).willReturn(Optional.of(counselor));

        assertThatThrownBy(() -> counselorSelfService.updateMe(
                1L, new CounselorSelfUpdateRequest(null, null, "newPass123!", null)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CURRENT_PASSWORD);
    }

    @Test
    @DisplayName("존재하지 않는 계정을 수정하려 하면 ACCOUNT_NOT_FOUND")
    void updateMe_accountNotFound_throws() {
        given(accountRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> counselorSelfService.updateMe(
                999L, new CounselorSelfUpdateRequest("박상담", null, null, null)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.ACCOUNT_NOT_FOUND);
    }
}