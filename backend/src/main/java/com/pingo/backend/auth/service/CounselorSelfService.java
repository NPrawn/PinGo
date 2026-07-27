package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.dto.request.CounselorSelfUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CounselorSelfService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountDetailResponse getMe(Long accountId){
        Account account = findAccount(accountId);
        return toDetailResponse(account);
    }

    @Transactional
    public AccountDetailResponse updateMe(Long accountId, CounselorSelfUpdateRequest request){
        Account account = findAccount(accountId);

        if(request.name() != null){
            account.changeName(request.name());
        }
        if(request.status() != null){
            account.changeStatus(request.status());
        }
        if(request.newPassword() != null){
            if(request.currentPassword() == null
                    || !passwordEncoder.matches(request.currentPassword(),account.getPasswordHash())){
                throw new BusinessException(ErrorCode.INVALID_CURRENT_PASSWORD);
            }
            account.changePassword(passwordEncoder.encode(request.newPassword()));
        }
        return toDetailResponse(account);
    }

    private Account findAccount(Long accountId){
        return accountRepository.findById(accountId)
                .orElseThrow(()-> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
    }

    private AccountDetailResponse toDetailResponse(Account account) {
        return new AccountDetailResponse(
                account.getAccountId(), account.getLoginId(), account.getName(),
                account.getStationId(), account.isActive(), account.getStatus(), account.getCreatedAt()
        );
    }
}
