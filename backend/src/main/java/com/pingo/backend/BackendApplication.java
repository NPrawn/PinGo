package com.pingo.backend;

import com.pingo.backend.webrtc.config.IceServerProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(IceServerProperties.class)
public class BackendApplication {

    public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
