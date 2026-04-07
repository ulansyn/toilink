package kg.toilink.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record CreateEventRequest(

        @NotBlank(message = "Title is required")
        @Size(max = 200, message = "Title must not exceed 200 characters")
        String title,

        Long templateId,

        LocalDateTime eventDate,

        @Size(max = 500, message = "Location must not exceed 500 characters")
        String location,

        @Size(max = 500, message = "Cover image URL must not exceed 500 characters")
        String coverImageUrl,

        LocalDateTime rsvpDeadline,

        @Size(max = 10, message = "Language code must not exceed 10 characters")
        String language,

        // Raw JSONB: filled blocks data from the template
        String blocksConfig
) {}
