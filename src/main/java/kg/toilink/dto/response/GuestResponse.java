package kg.toilink.dto.response;

import kg.toilink.entity.Guest;

import java.time.LocalDateTime;
import java.util.UUID;

public record GuestResponse(
        Long id,
        Long eventId,
        String name,
        String phone,
        String source,
        String notes,
        UUID token,
        String rsvpStatus,
        String side,
        Long relatedToId,
        String relationType,
        String relatedToName,
        Long tableId,
        String tableName,
        LocalDateTime createdAt
) {
    public static GuestResponse from(Guest g) {
        return from(g, null, null, null);
    }

    public static GuestResponse from(Guest g, String rsvpStatus) {
        return from(g, rsvpStatus, null, null);
    }

    public static GuestResponse from(Guest g, String rsvpStatus, String relatedToName) {
        return from(g, rsvpStatus, relatedToName, null);
    }

    public static GuestResponse from(Guest g, String rsvpStatus, String relatedToName, String tableName) {
        return new GuestResponse(
                g.getId(),
                g.getEvent().getId(),
                g.getName(),
                g.getPhone(),
                g.getSource(),
                g.getNotes(),
                g.getToken(),
                rsvpStatus,
                g.getSide(),
                g.getRelatedToId(),
                g.getRelationType(),
                relatedToName,
                g.getTableId(),
                tableName,
                g.getCreatedAt()
        );
    }
}
