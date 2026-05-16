package kg.toilink.controller.organizer;

import jakarta.validation.Valid;
import kg.toilink.dto.request.CreateGuestRequest;
import kg.toilink.dto.request.UpdateGuestRequest;
import kg.toilink.dto.response.GuestResponse;
import kg.toilink.service.GuestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/events/{eventId}/guests")
@RequiredArgsConstructor
public class GuestController {

    private final GuestService guestService;

    @GetMapping
    public List<GuestResponse> getAll(@PathVariable Long eventId,
                                      @AuthenticationPrincipal UserDetails user) {
        return guestService.findAllByEvent(eventId, user.getUsername());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GuestResponse add(@PathVariable Long eventId,
                             @Valid @RequestBody CreateGuestRequest request,
                             @AuthenticationPrincipal UserDetails user) {
        return guestService.addGuest(eventId, request, user.getUsername());
    }

    @PutMapping("/{guestId}")
    public GuestResponse update(@PathVariable Long eventId,
                                @PathVariable Long guestId,
                                @Valid @RequestBody UpdateGuestRequest request,
                                @AuthenticationPrincipal UserDetails user) {
        return guestService.updateGuest(eventId, guestId, request, user.getUsername());
    }

    @DeleteMapping("/{guestId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long eventId,
                       @PathVariable Long guestId,
                       @AuthenticationPrincipal UserDetails user) {
        guestService.deleteGuest(eventId, guestId, user.getUsername());
    }
}
