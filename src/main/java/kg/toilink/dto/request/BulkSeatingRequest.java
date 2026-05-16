package kg.toilink.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record BulkSeatingRequest(
        List<NewTable> newTables,
        @NotNull List<Assignment> assignments
) {
    public record NewTable(
            @NotNull Long tempId,
            @NotNull @Size(max = 100) String name,
            Integer capacity
    ) {}

    public record Assignment(
            @NotNull Long guestId,
            Long tableId
    ) {}
}
