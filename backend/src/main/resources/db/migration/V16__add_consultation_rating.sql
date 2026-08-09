ALTER TABLE consultation_session
    ADD COLUMN rating_score TINYINT NULL,
    ADD COLUMN rated_at DATETIME(6) NULL,
    ADD CONSTRAINT ck_consultation_rating_score
        CHECK (rating_score IS NULL OR rating_score BETWEEN 1 AND 5);