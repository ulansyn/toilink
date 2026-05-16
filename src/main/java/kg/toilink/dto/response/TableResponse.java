package kg.toilink.dto.response;

import kg.toilink.entity.SeatingTable;

import java.time.LocalDateTime;

public record TableResponse(
        Long id,
        Long eventId,
        String name,
        Integer capacity,
        int guestCount,
        LocalDateTime createdAt
) {
    public static TableResponse from(SeatingTable t, int guestCount) {
        return new TableResponse(t.getId(), t.getEvent().getId(), t.getName(), t.getCapacity(), guestCount, t.getCreatedAt());
    }
}
