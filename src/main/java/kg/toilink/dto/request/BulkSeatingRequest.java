package kg.toilink.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record BulkSeatingRequest(
        @NotNull List<Assignment> assignments
) {
    public record Assignment(
            @NotNull Long guestId,
            Long tableId
    ) {}
}
