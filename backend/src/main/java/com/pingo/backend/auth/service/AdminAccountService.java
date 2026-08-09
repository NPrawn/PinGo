package com.pingo.backend.auth.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.dto.request.AccountUpdateRequest;
import com.pingo.backend.auth.dto.response.AccountDetailResponse;
import com.pingo.backend.auth.dto.response.AccountListResponse;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminAccountService {

    private final AccountRepository accountRepository;
    private final StationRepository stationRepository;

    public List<AccountListResponse> listCounselors(Long stationId, Boolean isActive){
        return accountRepository.findCounselors(AccountType.COUNSELOR, stationId, isActive).stream()
                .map(this::toListResponse)
                .toList();
    }

    public AccountDetailResponse getCounselor(Long accountId){
        Account account = findCounselor(accountId);
        return toDetailResponse(account);
    }

    @Transactional
    public AccountDetailResponse updateCounselor(Long accountId, AccountUpdateRequest request){
        Account account = findCounselor(accountId);

        if(request.stationId() != null){
            stationRepository.findById(request.stationId())
                    .orElseThrow(()-> new BusinessException(ErrorCode.STATION_NOT_FOUND));
            account.changeStation(request.stationId());
        }

        if(request.isActive() != null){
            if(request.isActive()){
                account.approve();
            } else {
                account.deactivate();
            }
        }

        return toDetailResponse(account);
    }

    @Transactional
    public void deactivateCounselor(Long accountId){
        Account account = findCounselor(accountId);
        account.deactivate();
    }

    private Account findCounselor(Long accountId){
        return accountRepository.findById(accountId)
                .filter(a -> a.getAccountType() == AccountType.COUNSELOR)
                .orElseThrow(()-> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
    }

    private AccountListResponse toListResponse(Account account){
        return new AccountListResponse(
                account.getAccountId(),
                account.getLoginId(),
                account.getName(),
                account.getStationId(),
                account.isActive(),
                account.getStatus()
        );
    }

    private AccountDetailResponse toDetailResponse(Account account){
        return new AccountDetailResponse(
                account.getAccountId(),
                account.getLoginId(),
                account.getName(),
                account.getStationId(),
                account.isActive(),
                account.getStatus(),
                account.getCreatedAt()
        );
    }

}
