package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.CreateTableRequest;
import kg.toilink.dto.request.UpdateTableRequest;
import kg.toilink.dto.response.TableResponse;
import kg.toilink.service.SeatingTableService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/events/{eventId}/tables")
@RequiredArgsConstructor
public class SeatingTableController {

    private final SeatingTableService tableService;

    @GetMapping
    public List<TableResponse> getAll(@PathVariable Long eventId,
                                      @AuthenticationPrincipal UserDetails user) {
        return tableService.findAllByEvent(eventId, user.getUsername());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TableResponse create(@PathVariable Long eventId,
                                @Valid @RequestBody CreateTableRequest req,
                                @AuthenticationPrincipal UserDetails user) {
        return tableService.create(eventId, req, user.getUsername());
    }

    @PutMapping("/{tableId}")
    public TableResponse update(@PathVariable Long eventId,
                                @PathVariable Long tableId,
                                @Valid @RequestBody UpdateTableRequest req,
                                @AuthenticationPrincipal UserDetails user) {
        return tableService.update(eventId, tableId, req, user.getUsername());
    }

    @DeleteMapping("/{tableId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long eventId,
                       @PathVariable Long tableId,
                       @AuthenticationPrincipal UserDetails user) {
        tableService.delete(eventId, tableId, user.getUsername());
    }
}
