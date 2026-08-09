package com.pingo.backend.webrtc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record IceServerResponse(
        List<String> urls,
        String username,
        String credential
) {
    public static IceServerResponse stun(List<String> urls) {
        return new IceServerResponse(urls, null, null);
    }

    public static IceServerResponse turn(List<String> urls, String username, String credential) {
        return new IceServerResponse(urls, username, credential);
    }
}
