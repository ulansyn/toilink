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

        @Pattern(regexp = "GROOM|BRIDE|SHARED|OTHER", message = "Side must be GROOM, BRIDE, SHARED or OTHER")
        String side,

        @Pattern(regexp = "ATTENDING|DECLINED|MAYBE", message = "Status must be ATTENDING, DECLINED or MAYBE")
        String rsvpStatus,

        @Size(max = 100)
        String companionName
) {}
