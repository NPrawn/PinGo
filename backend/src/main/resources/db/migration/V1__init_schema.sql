CREATE TABLE station (
                         station_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                         name_ko VARCHAR(100) NOT NULL,
                         name_en VARCHAR(100) NOT NULL,
                         line_info VARCHAR(100),
                         latitude DECIMAL(10, 7),
                         longitude DECIMAL(10, 7),
                         is_active BOOLEAN NOT NULL DEFAULT TRUE,
                         created_at DATETIME(6) NOT NULL,
                         updated_at DATETIME(6) NOT NULL
);

CREATE TABLE station_floor (
                               floor_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                               station_id BIGINT NOT NULL,
                               floor_code VARCHAR(20) NOT NULL,
                               floor_name VARCHAR(100),
                               floor_order INT NOT NULL,
                               created_at DATETIME(6) NOT NULL,
                               updated_at DATETIME(6) NOT NULL,
                               CONSTRAINT fk_station_floor_station
                                   FOREIGN KEY (station_id) REFERENCES station (station_id)
);

CREATE TABLE floor_map (
                           map_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                           floor_id BIGINT NOT NULL,
                           map_type VARCHAR(50) NOT NULL,
                           map_url VARCHAR(500) NOT NULL,
                           width INT,
                           height INT,
                           scale_m_per_px DECIMAL(10, 6),
                           version VARCHAR(100),
                           is_active BOOLEAN NOT NULL DEFAULT TRUE,
                           created_at DATETIME(6) NOT NULL,
                           updated_at DATETIME(6) NOT NULL,
                           CONSTRAINT fk_floor_map_floor
                               FOREIGN KEY (floor_id) REFERENCES station_floor (floor_id)
);

CREATE TABLE route_node (
                            node_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                            station_id BIGINT NOT NULL,
                            floor_id BIGINT NOT NULL,
                            node_type VARCHAR(50) NOT NULL,
                            name VARCHAR(100),
                            map_x DECIMAL(10, 3) NOT NULL,
                            map_y DECIMAL(10, 3) NOT NULL,
                            is_landmark BOOLEAN NOT NULL DEFAULT FALSE,
                            created_at DATETIME(6) NOT NULL,
                            updated_at DATETIME(6) NOT NULL,
                            CONSTRAINT fk_route_node_station
                                FOREIGN KEY (station_id) REFERENCES station (station_id),
                            CONSTRAINT fk_route_node_floor
                                FOREIGN KEY (floor_id) REFERENCES station_floor (floor_id)
);

CREATE TABLE facility (
                          facility_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                          station_id BIGINT NOT NULL,
                          floor_id BIGINT NOT NULL,
                          facility_type VARCHAR(50) NOT NULL,
                          name_ko VARCHAR(100) NOT NULL,
                          name_en VARCHAR(100),
                          map_x DECIMAL(10, 3) NOT NULL,
                          map_y DECIMAL(10, 3) NOT NULL,
                          linked_node_id BIGINT,
                          is_accessible BOOLEAN NOT NULL DEFAULT FALSE,
                          is_active BOOLEAN NOT NULL DEFAULT TRUE,
                          created_at DATETIME(6) NOT NULL,
                          updated_at DATETIME(6) NOT NULL,
                          CONSTRAINT fk_facility_station
                              FOREIGN KEY (station_id) REFERENCES station (station_id),
                          CONSTRAINT fk_facility_floor
                              FOREIGN KEY (floor_id) REFERENCES station_floor (floor_id),
                          CONSTRAINT fk_facility_linked_node
                              FOREIGN KEY (linked_node_id) REFERENCES route_node (node_id)
);

CREATE TABLE exit_detail (
                             exit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                             facility_id BIGINT NOT NULL,
                             exit_number VARCHAR(20) NOT NULL,
                             outside_latitude DECIMAL(10, 7),
                             outside_longitude DECIMAL(10, 7),
                             description_ko TEXT,
                             description_en TEXT,
                             CONSTRAINT fk_exit_detail_facility
                                 FOREIGN KEY (facility_id) REFERENCES facility (facility_id)
);

CREATE TABLE route_edge (
                            edge_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                            station_id BIGINT NOT NULL,
                            from_node_id BIGINT NOT NULL,
                            to_node_id BIGINT NOT NULL,
                            distance_m DECIMAL(10, 2) NOT NULL,
                            estimated_time_sec INT,
                            move_type VARCHAR(50) NOT NULL,
                            is_accessible BOOLEAN NOT NULL DEFAULT FALSE,
                            is_bidirectional BOOLEAN NOT NULL DEFAULT TRUE,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            created_at DATETIME(6) NOT NULL,
                            updated_at DATETIME(6) NOT NULL,
                            CONSTRAINT fk_route_edge_station
                                FOREIGN KEY (station_id) REFERENCES station (station_id),
                            CONSTRAINT fk_route_edge_from_node
                                FOREIGN KEY (from_node_id) REFERENCES route_node (node_id),
                            CONSTRAINT fk_route_edge_to_node
                                FOREIGN KEY (to_node_id) REFERENCES route_node (node_id)
);

CREATE TABLE nearby_place (
                              place_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                              station_id BIGINT NOT NULL,
                              name_ko VARCHAR(100) NOT NULL,
                              name_en VARCHAR(100),
                              category VARCHAR(50) NOT NULL,
                              address VARCHAR(255),
                              latitude DECIMAL(10, 7),
                              longitude DECIMAL(10, 7),
                              external_map_url VARCHAR(500),
                              is_active BOOLEAN NOT NULL DEFAULT TRUE,
                              created_at DATETIME(6) NOT NULL,
                              updated_at DATETIME(6) NOT NULL,
                              CONSTRAINT fk_nearby_place_station
                                  FOREIGN KEY (station_id) REFERENCES station (station_id)
);

CREATE TABLE place_exit_recommendation (
                                           recommendation_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                           place_id BIGINT NOT NULL,
                                           exit_facility_id BIGINT NOT NULL,
                                           priority INT NOT NULL DEFAULT 1,
                                           reason_ko VARCHAR(255),
                                           reason_en VARCHAR(255),
                                           walking_time_min INT,
                                           is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                                           created_at DATETIME(6) NOT NULL,
                                           updated_at DATETIME(6) NOT NULL,
                                           CONSTRAINT fk_place_exit_recommendation_place
                                               FOREIGN KEY (place_id) REFERENCES nearby_place (place_id),
                                           CONSTRAINT fk_place_exit_recommendation_exit
                                               FOREIGN KEY (exit_facility_id) REFERENCES facility (facility_id)
);

CREATE TABLE user_session (
                              user_session_id VARCHAR(64) PRIMARY KEY,
                              language VARCHAR(10) NOT NULL,
                              selected_station_id BIGINT,
                              current_node_id BIGINT,
                              destination_type VARCHAR(50),
                              destination_id BIGINT,
                              last_gps_latitude DECIMAL(10, 7),
                              last_gps_longitude DECIMAL(10, 7),
                              created_at DATETIME(6) NOT NULL,
                              last_active_at DATETIME(6) NOT NULL,
                              expires_at DATETIME(6),
                              CONSTRAINT fk_user_session_station
                                  FOREIGN KEY (selected_station_id) REFERENCES station (station_id),
                              CONSTRAINT fk_user_session_current_node
                                  FOREIGN KEY (current_node_id) REFERENCES route_node (node_id)
);

CREATE TABLE counselor (
                           counselor_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                           station_id BIGINT NOT NULL,
                           login_id VARCHAR(100) NOT NULL,
                           password_hash VARCHAR(255) NOT NULL,
                           name VARCHAR(100) NOT NULL,
                           status VARCHAR(50) NOT NULL,
                           is_active BOOLEAN NOT NULL DEFAULT TRUE,
                           created_at DATETIME(6) NOT NULL,
                           updated_at DATETIME(6) NOT NULL,
                           CONSTRAINT uk_counselor_login_id UNIQUE (login_id),
                           CONSTRAINT fk_counselor_station
                               FOREIGN KEY (station_id) REFERENCES station (station_id)
);

CREATE TABLE consultation_session (
                                      consultation_id VARCHAR(64) PRIMARY KEY,
                                      user_session_id VARCHAR(64) NOT NULL,
                                      station_id BIGINT NOT NULL,
                                      counselor_id BIGINT,
                                      problem_type VARCHAR(50) NOT NULL,
                                      status VARCHAR(50) NOT NULL,
                                      current_node_id BIGINT,
                                      destination_type VARCHAR(50),
                                      destination_id BIGINT,
                                      video_consent BOOLEAN NOT NULL DEFAULT FALSE,
                                      audio_consent BOOLEAN NOT NULL DEFAULT FALSE,
                                      requested_at DATETIME(6) NOT NULL,
                                      accepted_at DATETIME(6),
                                      ended_at DATETIME(6),
                                      CONSTRAINT fk_consultation_session_user_session
                                          FOREIGN KEY (user_session_id) REFERENCES user_session (user_session_id),
                                      CONSTRAINT fk_consultation_session_station
                                          FOREIGN KEY (station_id) REFERENCES station (station_id),
                                      CONSTRAINT fk_consultation_session_counselor
                                          FOREIGN KEY (counselor_id) REFERENCES counselor (counselor_id),
                                      CONSTRAINT fk_consultation_session_current_node
                                          FOREIGN KEY (current_node_id) REFERENCES route_node (node_id)
);

CREATE TABLE consultation_event (
                                    event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                    consultation_id VARCHAR(64) NOT NULL,
                                    sender_type VARCHAR(50) NOT NULL,
                                    event_type VARCHAR(50) NOT NULL,
                                    payload_json JSON,
                                    created_at DATETIME(6) NOT NULL,
                                    CONSTRAINT fk_consultation_event_session
                                        FOREIGN KEY (consultation_id) REFERENCES consultation_session (consultation_id)
);

CREATE TABLE admin (
                       admin_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                       login_id VARCHAR(100) NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       name VARCHAR(100) NOT NULL,
                       role VARCHAR(50) NOT NULL,
                       is_active BOOLEAN NOT NULL DEFAULT TRUE,
                       created_at DATETIME(6) NOT NULL,
                       updated_at DATETIME(6) NOT NULL,
                       CONSTRAINT uk_admin_login_id UNIQUE (login_id)
);

CREATE TABLE admin_audit_log (
                                 audit_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                 admin_id BIGINT NOT NULL,
                                 action_type VARCHAR(50) NOT NULL,
                                 target_table VARCHAR(100) NOT NULL,
                                 target_id VARCHAR(100) NOT NULL,
                                 before_json JSON,
                                 after_json JSON,
                                 created_at DATETIME(6) NOT NULL,
                                 CONSTRAINT fk_admin_audit_log_admin
                                     FOREIGN KEY (admin_id) REFERENCES admin (admin_id)
);

CREATE TABLE vps_map (
                         vps_map_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                         station_id BIGINT NOT NULL,
                         provider VARCHAR(50) NOT NULL,
                         version VARCHAR(100) NOT NULL,
                         status VARCHAR(50) NOT NULL,
                         description TEXT,
                         created_at DATETIME(6) NOT NULL,
                         updated_at DATETIME(6) NOT NULL,
                         CONSTRAINT fk_vps_map_station
                             FOREIGN KEY (station_id) REFERENCES station (station_id)
);

CREATE TABLE vps_reference_image (
                                     reference_image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                     vps_map_id BIGINT NOT NULL,
                                     station_id BIGINT NOT NULL,
                                     floor_id BIGINT NOT NULL,
                                     node_id BIGINT,
                                     image_url VARCHAR(500) NOT NULL,
                                     capture_direction DECIMAL(6, 2),
                                     description TEXT,
                                     created_at DATETIME(6) NOT NULL,
                                     CONSTRAINT fk_vps_reference_image_vps_map
                                         FOREIGN KEY (vps_map_id) REFERENCES vps_map (vps_map_id),
                                     CONSTRAINT fk_vps_reference_image_station
                                         FOREIGN KEY (station_id) REFERENCES station (station_id),
                                     CONSTRAINT fk_vps_reference_image_floor
                                         FOREIGN KEY (floor_id) REFERENCES station_floor (floor_id),
                                     CONSTRAINT fk_vps_reference_image_node
                                         FOREIGN KEY (node_id) REFERENCES route_node (node_id)
);

CREATE TABLE localization_log (
                                  localization_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                                  user_session_id VARCHAR(64) NOT NULL,
                                  station_id BIGINT NOT NULL,
                                  method VARCHAR(50) NOT NULL,
                                  result_status VARCHAR(50) NOT NULL,
                                  matched_node_id BIGINT,
                                  confidence_score DECIMAL(5, 4),
                                  confidence_label VARCHAR(50),
                                  error_message TEXT,
                                  created_at DATETIME(6) NOT NULL,
                                  CONSTRAINT fk_localization_log_user_session
                                      FOREIGN KEY (user_session_id) REFERENCES user_session (user_session_id),
                                  CONSTRAINT fk_localization_log_station
                                      FOREIGN KEY (station_id) REFERENCES station (station_id),
                                  CONSTRAINT fk_localization_log_matched_node
                                      FOREIGN KEY (matched_node_id) REFERENCES route_node (node_id)
);

CREATE TABLE location_share (
                                share_id VARCHAR(64) PRIMARY KEY,
                                owner_session_id VARCHAR(64) NOT NULL,
                                station_id BIGINT NOT NULL,
                                shared_node_id BIGINT NOT NULL,
                                expires_at DATETIME(6) NOT NULL,
                                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                                created_at DATETIME(6) NOT NULL,
                                CONSTRAINT fk_location_share_owner_session
                                    FOREIGN KEY (owner_session_id) REFERENCES user_session (user_session_id),
                                CONSTRAINT fk_location_share_station
                                    FOREIGN KEY (station_id) REFERENCES station (station_id),
                                CONSTRAINT fk_location_share_shared_node
                                    FOREIGN KEY (shared_node_id) REFERENCES route_node (node_id)
);

CREATE TABLE translation (
                             translation_id BIGINT AUTO_INCREMENT PRIMARY KEY,
                             resource_type VARCHAR(50) NOT NULL,
                             resource_key VARCHAR(255) NOT NULL,
                             language_code VARCHAR(10) NOT NULL,
                             text TEXT NOT NULL,
                             created_at DATETIME(6) NOT NULL,
                             updated_at DATETIME(6) NOT NULL
);

CREATE INDEX idx_station_name_ko ON station (name_ko);
CREATE INDEX idx_station_name_en ON station (name_en);

CREATE INDEX idx_facility_station_floor ON facility (station_id, floor_id);
CREATE INDEX idx_facility_type ON facility (facility_type);

CREATE INDEX idx_route_node_station_floor ON route_node (station_id, floor_id);
CREATE INDEX idx_route_edge_nodes ON route_edge (from_node_id, to_node_id);

CREATE INDEX idx_nearby_place_station_category ON nearby_place (station_id, category);
CREATE INDEX idx_place_exit_recommendation_place ON place_exit_recommendation (place_id);

CREATE INDEX idx_consultation_session_station_status ON consultation_session (station_id, status);
CREATE INDEX idx_consultation_session_user_session ON consultation_session (user_session_id);

CREATE INDEX idx_localization_log_station_created_at ON localization_log (station_id, created_at);
CREATE INDEX idx_counselor_station_status ON counselor (station_id, status);