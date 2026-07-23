package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.dto.request.LoginRequest;
import com.pingo.backend.auth.dto.response.LoginResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.security.JwtProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {
    private final AccountRepository accountRepository;
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
}
