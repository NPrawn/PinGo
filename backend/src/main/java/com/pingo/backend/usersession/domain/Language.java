package com.pingo.backend.usersession.domain;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum Language {
    KO, EN, JA, ZH;

    public static final Language DEFAULT = EN;

    @JsonCreator
    public static Language from(String value){
        return Language.valueOf(value.toUpperCase());
    }

    @JsonValue
    public String toValue(){
        return name().toLowerCase();
    }
}
