package com.pingo.backend.webrtc.service;

import com.pingo.backend.webrtc.config.IceServerProperties;
import com.pingo.backend.webrtc.dto.IceServersResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class IceServerServiceTest {

    @Test
    void getIceServersReturnsStunOnlyWhenTurnCredentialIsMissing() {
        IceServerService service = new IceServerService(new IceServerProperties(
                List.of("stun:stun.l.google.com:19302"),
                List.of("turn:turn.example.com:3478"),
                "",
                ""
        ));

        IceServersResponse response = service.getIceServers();

        assertThat(response.iceServers()).hasSize(1);
        assertThat(response.iceServers().get(0).urls())
                .containsExactly("stun:stun.l.google.com:19302");
        assertThat(response.iceServers().get(0).username()).isNull();
        assertThat(response.iceServers().get(0).credential()).isNull();
    }

    @Test
    void getIceServersReturnsTurnWhenUrlAndCredentialAreConfigured() {
        IceServerService service = new IceServerService(new IceServerProperties(
                List.of("stun:stun.l.google.com:19302"),
                List.of("turn:turn.example.com:3478?transport=udp", " turns:turn.example.com:5349 "),
                "turn-user",
                "turn-secret"
        ));

        IceServersResponse response = service.getIceServers();

        assertThat(response.iceServers()).hasSize(2);
        assertThat(response.iceServers().get(0).urls())
                .containsExactly("stun:stun.l.google.com:19302");
        assertThat(response.iceServers().get(1).urls())
                .containsExactly("turn:turn.example.com:3478?transport=udp", "turns:turn.example.com:5349");
        assertThat(response.iceServers().get(1).username()).isEqualTo("turn-user");
        assertThat(response.iceServers().get(1).credential()).isEqualTo("turn-secret");
    }

    @Test
    void getIceServersIgnoresBlankUrls() {
        IceServerService service = new IceServerService(new IceServerProperties(
                List.of(" ", "stun:stun.example.com:19302"),
                List.of(""),
                "turn-user",
                "turn-secret"
        ));

        IceServersResponse response = service.getIceServers();

        assertThat(response.iceServers()).hasSize(1);
        assertThat(response.iceServers().get(0).urls())
                .containsExactly("stun:stun.example.com:19302");
    }
}
