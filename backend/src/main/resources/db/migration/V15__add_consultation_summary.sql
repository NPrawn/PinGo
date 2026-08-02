CREATE TABLE consultation_summary (
                                      summary_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                      consultation_id VARCHAR(64) NOT NULL,
                                      status VARCHAR(20) NOT NULL,
                                      summary_text VARCHAR(500),
                                      start_location_label VARCHAR(200),
                                      guided_exit_facility_id BIGINT,
                                      guided_exit_label VARCHAR(100),
                                      route_type VARCHAR(20),
                                      created_at DATETIME(6) NOT NULL,
                                      completed_at DATETIME(6),
                                      CONSTRAINT uk_consultation_summary_consultation UNIQUE (consultation_id),
                                      CONSTRAINT fk_consultation_summary_session
                                          FOREIGN KEY (consultation_id) REFERENCES consultation_session (consultation_id),
                                      CONSTRAINT fk_consultation_summary_exit
                                          FOREIGN KEY (guided_exit_facility_id) REFERENCES facility (facility_id)
);

CREATE TABLE consultation_transcript (
                                         transcript_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                         consultation_id VARCHAR(64) NOT NULL,
                                         seq INT NOT NULL,
                                         speaker VARCHAR(20) NOT NULL,
                                         content TEXT NOT NULL,
                                         CONSTRAINT uk_consultation_transcript_seq UNIQUE (consultation_id, seq),
                                         CONSTRAINT fk_consultation_transcript_session
                                             FOREIGN KEY (consultation_id) REFERENCES consultation_session (consultation_id)
);

CREATE INDEX idx_consultation_transcript_consultation
    ON consultation_transcript (consultation_id, seq);