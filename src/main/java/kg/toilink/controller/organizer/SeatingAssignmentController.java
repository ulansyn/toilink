package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.BulkSeatingRequest;
import kg.toilink.dto.response.TableResponse;
import kg.toilink.service.SeatingTableService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/events/{eventId}/seating")
@RequiredArgsConstructor
public class SeatingAssignmentController {

    private final SeatingTableService tableService;

    public record BulkSeatingResponse(List<TableResponse> createdTables) {}

    @PutMapping
    public BulkSeatingResponse bulkAssign(@PathVariable Long eventId,
                                          @Valid @RequestBody BulkSeatingRequest req,
                                          @AuthenticationPrincipal UserDetails user) {
        List<TableResponse> created = tableService.bulkAssign(eventId, req, user.getUsername());
        return new BulkSeatingResponse(created);
    }
}
