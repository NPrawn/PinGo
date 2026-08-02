-- 승인 대기 상담자도 상담 상태 기본값을 갖도록 보정한다.
-- V7은 활성 상담자만 채웠고, 가입 시점부터 AVAILABLE로 저장하도록 바뀌었다.
UPDATE account
SET status = 'AVAILABLE'
WHERE account_type = 'COUNSELOR'
  AND status IS NULL;
