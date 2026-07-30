UPDATE account
SET status = 'AVAILABLE'
WHERE account_type = 'COUNSELOR'
  AND is_active = TRUE
  AND status IS NULL;
