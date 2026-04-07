package kg.toilink.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record RsvpRequest(

        // Optional: if guest was pre-added by organizer, they arrive via token link
        UUID guestToken,

        String name,

        @NotBlank(message = "Status is required")
        @Pattern(regexp = "ATTENDING|DECLINED|MAYBE", message = "Status must be ATTENDING, DECLINED or MAYBE")
        String status,

        @Min(value = 1, message = "Group size must be at least 1")
        int groupSize,

        String comment
) {}
