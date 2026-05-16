package kg.toilink.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateGuestRequest(

        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @Size(max = 20, message = "Phone must not exceed 20 characters")
        String phone,

        String notes,

        @Size(max = 30, message = "Side code must not exceed 30 characters")
        String side,

        Long relatedToId,

        @Size(max = 30)
        String relationType,

        // null = no change; "NONE" = clear status; ATTENDING/DECLINED/MAYBE = set
        String rsvpStatus,

        Long tableId
) {}
