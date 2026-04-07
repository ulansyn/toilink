package kg.toilink.dto.request;

import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record UpdateEventRequest(

        @Size(max = 200, message = "Title must not exceed 200 characters")
        String title,

        LocalDateTime eventDate,

        @Size(max = 500, message = "Location must not exceed 500 characters")
        String location,

        @Size(max = 500, message = "Cover image URL must not exceed 500 characters")
        String coverImageUrl,

        // DRAFT → PUBLISHED → CLOSED
        String status,

        LocalDateTime rsvpDeadline,

        @Size(max = 10, message = "Language code must not exceed 10 characters")
        String language,

        String blocksConfig
) {}
