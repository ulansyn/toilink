package kg.toilink.dto.response;

import kg.toilink.entity.Event;

import java.time.LocalDateTime;

public record EventResponse(
        Long id,
        Long userId,
        Long templateId,
        String title,
        LocalDateTime eventDate,
        String location,
        String coverImageUrl,
        String slug,
        String status,
        LocalDateTime rsvpDeadline,
        String language,
        String blocksConfig,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EventResponse from(Event e) {
        return new EventResponse(
                e.getId(),
                e.getUser() != null ? e.getUser().getId() : null,
                e.getTemplate() != null ? e.getTemplate().getId() : null,
                e.getTitle(),
                e.getEventDate(),
                e.getLocation(),
                e.getCoverImageUrl(),
                e.getSlug(),
                e.getStatus(),
                e.getRsvpDeadline(),
                e.getLanguage(),
                e.getBlocksConfig(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
