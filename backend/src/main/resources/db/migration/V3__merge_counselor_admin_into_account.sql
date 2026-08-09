CREATE TABLE account (
                         account_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                         account_type VARCHAR(20) NOT NULL,
                         station_id BIGINT NULL,
                         login_id VARCHAR(100) NOT NULL,
                         password_hash VARCHAR(255) NOT NULL,
                         name VARCHAR(100) NOT NULL,
                         status VARCHAR(50) NULL,
                         is_active BOOLEAN NOT NULL DEFAULT TRUE,
                         created_at DATETIME(6) NOT NULL,
                         updated_at DATETIME(6) NOT NULL,
                         CONSTRAINT uk_account_login_id UNIQUE (login_id),
                         CONSTRAINT fk_account_station FOREIGN KEY (station_id) REFERENCES station (station_id)
);

INSERT INTO account (account_type, station_id, login_id, password_hash, name, status, is_active, created_at, updated_at)
SELECT 'COUNSELOR', station_id, login_id, password_hash, name, status, is_active, created_at, updated_at
FROM counselor;

INSERT INTO account (account_type, station_id, login_id, password_hash, name, status, is_active, created_at, updated_at)
SELECT 'ADMIN', NULL, login_id, password_hash, name, NULL, is_active, created_at, updated_at
FROM admin;

-- consultation_session.counselor_id를 account_id 기준으로 재연결
ALTER TABLE consultation_session DROP FOREIGN KEY fk_consultation_session_counselor;
ALTER TABLE consultation_session ADD COLUMN account_id BIGINT NULL AFTER counselor_id;

UPDATE consultation_session cs
    JOIN counselor c ON cs.counselor_id = c.counselor_id
    JOIN account a ON a.login_id = c.login_id AND a.account_type = 'COUNSELOR'
    SET cs.account_id = a.account_id;

ALTER TABLE consultation_session DROP COLUMN counselor_id;
ALTER TABLE consultation_session CHANGE COLUMN account_id counselor_id BIGINT NULL;
ALTER TABLE consultation_session
    ADD CONSTRAINT fk_consultation_session_account
        FOREIGN KEY (counselor_id) REFERENCES account (account_id);

-- admin_audit_log.admin_id를 account_id 기준으로 재연결
ALTER TABLE admin_audit_log DROP FOREIGN KEY fk_admin_audit_log_admin;
ALTER TABLE admin_audit_log ADD COLUMN account_id BIGINT NULL AFTER admin_id;

UPDATE admin_audit_log al
    JOIN admin ad ON al.admin_id = ad.admin_id
    JOIN account a ON a.login_id = ad.login_id AND a.account_type = 'ADMIN'
    SET al.account_id = a.account_id;

ALTER TABLE admin_audit_log DROP COLUMN admin_id;
ALTER TABLE admin_audit_log CHANGE COLUMN account_id admin_id BIGINT NOT NULL;
ALTER TABLE admin_audit_log
    ADD CONSTRAINT fk_admin_audit_log_account
        FOREIGN KEY (admin_id) REFERENCES account (account_id);

-- 기존 테이블 제거
DROP TABLE counselor;
DROP TABLE admin;

-- 조회 패턴에 맞춘 인덱스 재구성
CREATE INDEX idx_account_type_station_status ON account (account_type, station_id, status);