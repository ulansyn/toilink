package kg.toilink.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record RsvpRequest(

        // Optional: if guest was pre-added by organizer, they arrive via token link
        UUID guestToken,

        String name,

        @Size(max = 20)
        String phone,

        // Optional: group code from URL path /e/{slug}/{groupCode} — controller validates against event.guestGroups
        @Size(max = 30)
        String groupCode,

        // Optional: companion name (+1 spouse) — only used if RSVP block has allowCompanion=true
        @Size(max = 100)
        String spouseName,

        @NotBlank(message = "Status is required")
        @Pattern(regexp = "ATTENDING|DECLINED|MAYBE", message = "Status must be ATTENDING, DECLINED or MAYBE")
        String status,

        @Min(value = 1, message = "Group size must be at least 1")
        @Max(value = 20, message = "Group size must not exceed 20")
        Integer groupSize,

        String comment
) {}
