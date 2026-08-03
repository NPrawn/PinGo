package com.pingo.backend.translation.service;

/** 자막 한 줄을 옮긴다. 옮기지 못하면 null 을 돌려준다. */
public interface Translator {

    String translate(String text, String targetLanguage);
}
