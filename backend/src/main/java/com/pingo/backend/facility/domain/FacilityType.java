package com.pingo.backend.facility.domain;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/**
 * 역 내부 시설 유형. erd_최종.md 의 facility_type 정의를 기준으로 한다.
 * DB 에는 code(소문자 문자열)로 저장한다.
 */
public enum FacilityType {

    EXIT("exit"),
    GATE("gate"),
    PLATFORM("platform"),
    TRANSFER_PASSAGE("transfer_passage"),
    STAIR("stair"),
    ESCALATOR("escalator"),
    ELEVATOR("elevator"),
    RESTROOM("restroom"),
    STATION_OFFICE("station_office"),
    TICKET_MACHINE("ticket_machine"),
    CARD_CHARGER("card_charger"),
    LOCKER("locker"),
    INFO("info"),
    PHARMACY("pharmacy"),
    CONVENIENCE_STORE("convenience_store"),
    CURRENCY_EXCHANGE_MACHINE("currency_exchange_machine"),
    CLAW_MACHINE_ARCADE("claw_machine_arcade");

    private final String code;

    FacilityType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static Optional<FacilityType> fromCode(String rawValue) {
        if (rawValue == null) {
            return Optional.empty();
        }
        String normalized = rawValue.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values())
                .filter(type -> type.code.equals(normalized))
                .findFirst();
    }
}
