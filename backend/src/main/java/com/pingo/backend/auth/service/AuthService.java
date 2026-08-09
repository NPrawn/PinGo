package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.dto.request.LoginRequest;
import com.pingo.backend.auth.dto.request.SignupRequest;
import com.pingo.backend.auth.dto.response.LoginResponse;
import com.pingo.backend.auth.dto.response.SignupResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.security.JwtProvider;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {
    private final AccountRepository accountRepository;
    private final StationRepository stationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    public LoginResponse login(LoginRequest request){
        Account account = accountRepository.findByLoginId(request.loginId())
                .orElseThrow(()-> new BusinessException(ErrorCode.INVALID_CREDENTIALS));

        if(!passwordEncoder.matches(request.password(), account.getPasswordHash())){
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }
        if(!account.isActive()){
            throw new BusinessException(ErrorCode.INACTIVE_ACCOUNT);
        }

        String accessToken = jwtProvider.createAccountToken(
                account.getAccountId(), account.getAccountType(), account.getStationId());

        return new LoginResponse(
                accessToken,
                account.getAccountType().name(),
                account.getAccountId(),
                account.getName(),
                account.getStationId(),
                account.getStatus()
        );
    }

    public boolean isLoginIdAvailable(String loginId){
        return !accountRepository.existsByLoginId(loginId);
    }

    @Transactional
    public SignupResponse signup(SignupRequest request){
        if(accountRepository.existsByLoginId(request.loginId())){
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }

        stationRepository.findByIdAndActiveTrue(request.stationId())
                .orElseThrow(()-> new BusinessException(ErrorCode.STATION_NOT_FOUND));

        String passwordHash = passwordEncoder.encode(request.password());

        Account account = Account.signUpCounselor(request.loginId(), passwordHash, request.name(), request.stationId()
        );
        try {
            Account saved = accountRepository.save(account);
            return SignupResponse.from(saved);
        } catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.DUPLICATE_LOGIN_ID);
        }
    }
}
