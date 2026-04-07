package kg.toilink.dto.request;

import jakarta.validation.constraints.Size;

public record CreateGuestRequest(

        @Size(max = 100, message = "Name must not exceed 100 characters")
        String name,

        @Size(max = 20, message = "Phone must not exceed 20 characters")
        String phone,

        String notes
) {}
