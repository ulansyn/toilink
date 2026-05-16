package kg.toilink.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateGuestRequest(

        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @Size(max = 20, message = "Phone must not exceed 20 characters")
        String phone,

        String notes,

        Boolean personalInvite,

        @Size(max = 30, message = "Side code must not exceed 30 characters")
        String side,

        @Pattern(regexp = "ATTENDING|DECLINED|MAYBE", message = "Status must be ATTENDING, DECLINED or MAYBE")
        String rsvpStatus,

        @Size(max = 100)
        String companionName
) {}
