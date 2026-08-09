ALTER TABLE station_floor
    ADD CONSTRAINT uk_station_floor_station_code
        UNIQUE (station_id, floor_code);