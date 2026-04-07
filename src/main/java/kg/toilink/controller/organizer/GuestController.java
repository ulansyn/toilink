package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.CreateGuestRequest;
import kg.toilink.dto.response.GuestResponse;
import kg.toilink.service.GuestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/events/{eventId}/guests")
@RequiredArgsConstructor
public class GuestController {

    private final GuestService guestService;

    @GetMapping
    public List<GuestResponse> getAll(@PathVariable Long eventId,
                                      @RequestHeader("X-User-Phone") String phone) {
        return guestService.findAllByEvent(eventId, phone);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GuestResponse add(@PathVariable Long eventId,
                             @Valid @RequestBody CreateGuestRequest request,
                             @RequestHeader("X-User-Phone") String phone) {
        return guestService.addGuest(eventId, request, phone);
    }
}
