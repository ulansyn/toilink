package kg.toilink.dto.response;

import kg.toilink.entity.Event;

import java.time.LocalDateTime;
import java.util.UUID;

public record EventResponse(
        Long id,
        Long userId,
        Long templateId,
        String title,
        String person1,
        String person2,
        LocalDateTime eventDate,
        String location,
        String coverImageUrl,
        String slug,
        UUID previewToken,
        String status,
        LocalDateTime rsvpDeadline,
        String language,
        String blocksConfig,
        String guestGroups,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EventResponse from(Event e) {
        return new EventResponse(
                e.getId(),
                e.getUser() != null ? e.getUser().getId() : null,
                e.getTemplate() != null ? e.getTemplate().getId() : null,
                e.getTitle(),
                e.getPerson1(),
                e.getPerson2(),
                e.getEventDate(),
                e.getLocation(),
                e.getCoverImageUrl(),
                e.getSlug(),
                e.getPreviewToken(),
                e.getStatus(),
                e.getRsvpDeadline(),
                e.getLanguage(),
                e.getBlocksConfig(),
                e.getGuestGroups(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
