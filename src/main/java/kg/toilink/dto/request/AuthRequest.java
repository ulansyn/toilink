package kg.toilink.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthRequest(
        @NotBlank String phone,
        @NotBlank @Size(min = 4) String password
) {}
