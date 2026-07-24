package com.pingo.backend.auth.repository;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {
    Optional<Account> findByLoginId(String loginId);
    boolean existsByLoginId(String loginId);

    @Query("SELECT a FROM Account a WHERE a.accountType = :accountType " +
            "AND (:stationId IS NULL OR a.stationId = :stationId) " +
            "AND (:isActive IS NULL OR a.isActive = :isActive)")
    List<Account> findCounselors(@Param("accountType") AccountType accountType,
                                 @Param("stationId") Long stationId,
                                 @Param("isActive") Boolean isActive);
}
