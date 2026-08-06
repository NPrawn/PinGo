package com.pingo.backend.transcription.service;

/** 발화 한 토막을 받아쓴다. 받아쓰지 못하면 null 을 돌려준다. */
public interface Transcriber {

    String transcribe(String audioBase64, String mimeType, String language);
}
