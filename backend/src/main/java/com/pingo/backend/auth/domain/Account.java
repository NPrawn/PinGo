package com.pingo.backend.auth.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long accountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountType accountType;

    private Long stationId;

    @Column(nullable = false, unique = true)
    private String loginId;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String name;

    private String status;

    @Column(nullable = false)
    private boolean isActive;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate(){
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate(){
        this.updatedAt = LocalDateTime.now();
    }

    public static Account signUpCounselor(String loginIdl, String passwordHash, String name, Long stationId){
        Account account = new Account();
        account.accountType = AccountType.COUNSELOR;
        account.loginId = loginIdl;
        account.passwordHash = passwordHash;
        account.name = name;
        account.stationId = stationId;
        account.status = null;
        account.isActive = false;
        return account;
    }

    public void approve(){
        this.isActive = true;
    }

    public void deactivate(){
        this.isActive = false;
    }
}
