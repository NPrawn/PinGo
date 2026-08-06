package com.pingo.backend.transcription.service;

import org.springframework.web.multipart.MultipartFile;

/** 발화 한 토막을 받아쓴다. 받아쓰지 못하면 null 을 돌려준다. */
public interface Transcriber {

    String transcribe(MultipartFile audio, String language);
}
