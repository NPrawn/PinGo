package com.pingo.backend.consultation.dto.request;

import com.pingo.backend.consultation.domain.TranscriptSpeaker;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TranscriptSegmentRequest(

        @NotNull
        @Min(1)
        Integer seq,

        @NotNull
        TranscriptSpeaker speaker,

        @NotBlank
        @Size(max = 2000)
        String content
) {}