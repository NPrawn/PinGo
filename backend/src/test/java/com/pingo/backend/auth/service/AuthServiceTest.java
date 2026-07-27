package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.dto.request.SignupRequest;
import com.pingo.backend.auth.dto.response.SignupResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.security.JwtProvider;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtProvider jwtProvider;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("회원가입 성공 시 승인 대기(비활성) 상태의 COUNSELOR 계정이 생성된다")
    void signup_success() {
        SignupRequest request = new SignupRequest("newuser", "password123", "홍길동", 1L);

        given(accountRepository.existsByLoginId("newuser")).willReturn(false);
        given(stationRepository.findByIdAndActiveTrue(1L))
                .willReturn(Optional.of(mock(Station.class)));
        given(passwordEncoder.encode("password123")).willReturn("encodedPassword");
        given(accountRepository.save(any(Account.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        SignupResponse response = authService.signup(request);

        assertThat(response.loginId()).isEqualTo("newuser");
        assertThat(response.name()).isEqualTo("홍길동");
        assertThat(response.stationId()).isEqualTo(1L);

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        Account saved = captor.getValue();
        assertThat(saved.getAccountType()).isEqualTo(AccountType.COUNSELOR);
        assertThat(saved.isActive()).isFalse();
    }

    @Test
    @DisplayName("이미 사용 중인 아이디면 DUPLICATE_LOGIN_ID 예외가 발생하고 저장은 일어나지 않는다")
    void signup_duplicateLoginId_throws() {
        SignupRequest request = new SignupRequest("existing", "password123", "홍길동", 1L);
        given(accountRepository.existsByLoginId("existing")).willReturn(true);

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.DUPLICATE_LOGIN_ID);

        verify(accountRepository, never()).save(any());
    }

    @Test
    @DisplayName("존재하지 않는 역이면 STATION_NOT_FOUND 예외가 발생하고 저장은 일어나지 않는다")
    void signup_stationNotFound_throws() {
        SignupRequest request = new SignupRequest("newuser", "password123", "홍길동", 999L);

        given(accountRepository.existsByLoginId("newuser")).willReturn(false);
        given(stationRepository.findByIdAndActiveTrue(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATION_NOT_FOUND);

        verify(accountRepository, never()).save(any());
    }

    @Test
    @DisplayName("비활성 역으로 회원가입하면 STATION_NOT_FOUND")
    void signupFailsWhenStationInactive() {
        SignupRequest request = new SignupRequest("counselor01", "password123", "김상담", 1L);
        given(accountRepository.existsByLoginId("counselor01")).willReturn(false);
        // 비활성 역은 findByIdAndActiveTrue에서 애초에 조회되지 않음
        given(stationRepository.findByIdAndActiveTrue(1L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATION_NOT_FOUND);
    }

    @Test
    @DisplayName("사용 가능한 아이디면 true를 반환한다")
    void isLoginIdAvailable_true() {
        given(accountRepository.existsByLoginId("free")).willReturn(false);

        boolean available = authService.isLoginIdAvailable("free");

        assertThat(available).isTrue();
    }

    @Test
    @DisplayName("이미 사용 중인 아이디면 false를 반환한다")
    void isLoginIdAvailable_false() {
        given(accountRepository.existsByLoginId("taken")).willReturn(true);

        boolean available = authService.isLoginIdAvailable("taken");

        assertThat(available).isFalse();
    }
}