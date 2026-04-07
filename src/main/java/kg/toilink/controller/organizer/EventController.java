package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.CreateEventRequest;
import kg.toilink.dto.request.UpdateEventRequest;
import kg.toilink.dto.response.EventResponse;
import kg.toilink.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public List<EventResponse> getAll(@RequestHeader("X-User-Phone") String phone) {
        return eventService.findAllByUser(phone);
    }

    @GetMapping("/{id}")
    public EventResponse getById(@PathVariable Long id,
                                 @RequestHeader("X-User-Phone") String phone) {
        return eventService.findById(id, phone);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventResponse create(@Valid @RequestBody CreateEventRequest request,
                                @RequestHeader("X-User-Phone") String phone) {
        return eventService.create(request, phone);
    }

    @PutMapping("/{id}")
    public EventResponse update(@PathVariable Long id,
                                @Valid @RequestBody UpdateEventRequest request,
                                @RequestHeader("X-User-Phone") String phone) {
        return eventService.update(id, request, phone);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id,
                       @RequestHeader("X-User-Phone") String phone) {
        eventService.delete(id, phone);
    }
}
