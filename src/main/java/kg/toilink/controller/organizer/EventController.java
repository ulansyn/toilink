package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.CreateEventRequest;
import kg.toilink.dto.request.UpdateEventRequest;
import kg.toilink.dto.response.EventDashboardResponse;
import kg.toilink.dto.response.EventResponse;
import kg.toilink.dto.response.EventStatsResponse;
import kg.toilink.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public List<EventResponse> getAll(@AuthenticationPrincipal UserDetails user) {
        return eventService.findAllByUser(user.getUsername());
    }

    @GetMapping("/summary")
    public List<EventDashboardResponse> getSummary(@AuthenticationPrincipal UserDetails user) {
        return eventService.findDashboardByUser(user.getUsername());
    }

    @GetMapping("/{id}")
    public EventResponse getById(@PathVariable Long id,
                                 @AuthenticationPrincipal UserDetails user) {
        return eventService.findById(id, user.getUsername());
    }

    @GetMapping("/{id}/stats")
    public EventStatsResponse getStats(@PathVariable Long id,
                                       @AuthenticationPrincipal UserDetails user) {
        return eventService.getStats(id, user.getUsername());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(@Valid @RequestBody CreateEventRequest request,
                                @AuthenticationPrincipal UserDetails user) {
        return eventService.create(request, user.getUsername());
    }

    @PutMapping("/{id}")
    public EventResponse update(@PathVariable Long id,
                                @Valid @RequestBody UpdateEventRequest request,
                                @AuthenticationPrincipal UserDetails user) {
        return eventService.update(id, request, user.getUsername());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id,
                       @AuthenticationPrincipal UserDetails user) {
        eventService.delete(id, user.getUsername());
    }
}
