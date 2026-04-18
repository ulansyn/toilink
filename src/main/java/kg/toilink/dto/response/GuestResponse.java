package kg.toilink.dto.response;

import kg.toilink.entity.Guest;

import java.time.LocalDateTime;
import java.util.UUID;

public record GuestResponse(
        Long id,
        Long eventId,
        String name,
        String phone,
        String notes,
        UUID token,
        String rsvpStatus,
        LocalDateTime createdAt
) {
    public static GuestResponse from(Guest g) {
        return from(g, null);
    }

    public static GuestResponse from(Guest g, String rsvpStatus) {
        return new GuestResponse(
                g.getId(),
                g.getEvent().getId(),
                g.getName(),
                g.getPhone(),
                g.getNotes(),
                g.getToken(),
                rsvpStatus,
                g.getCreatedAt()
        );
    }
}
