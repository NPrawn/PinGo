package com.pingo.backend.localization.client;

public class AiLocalizationClientException extends RuntimeException {

    private final AiLocalizationClientErrorType errorType;

    public AiLocalizationClientException(AiLocalizationClientErrorType errorType, String message) {
        super(message);
        this.errorType = errorType;
    }

    public AiLocalizationClientException(
            AiLocalizationClientErrorType errorType,
            String message,
            Throwable cause
    ) {
        super(message, cause);
        this.errorType = errorType;
    }

    public AiLocalizationClientErrorType getErrorType() {
        return errorType;
    }
}
