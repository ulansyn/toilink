package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.BulkSeatingRequest;
import kg.toilink.service.SeatingTableService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/organizer/events/{eventId}/seating")
@RequiredArgsConstructor
public class SeatingAssignmentController {

    private final SeatingTableService tableService;

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void bulkAssign(@PathVariable Long eventId,
                           @Valid @RequestBody BulkSeatingRequest req,
                           @AuthenticationPrincipal UserDetails user) {
        tableService.bulkAssign(eventId, req, user.getUsername());
    }
}
