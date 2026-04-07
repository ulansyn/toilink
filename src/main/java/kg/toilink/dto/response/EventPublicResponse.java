package kg.toilink.dto.response;

import kg.toilink.entity.Event;

import java.time.LocalDateTime;

public record EventPublicResponse(
        String title,
        LocalDateTime eventDate,
        String location,
        String coverImageUrl,
        String slug,
        String status,
        String language,
        String blocksConfig,
        // Comes from the linked template — needed by event.js to know how to render
        String blocksSchema
) {
    public static EventPublicResponse from(Event e, String blocksSchema) {
        return new EventPublicResponse(
                e.getTitle(),
                e.getEventDate(),
                e.getLocation(),
                e.getCoverImageUrl(),
                e.getSlug(),
                e.getStatus(),
                e.getLanguage(),
                e.getBlocksConfig(),
                blocksSchema
        );
    }
}
