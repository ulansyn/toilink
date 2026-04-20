package kg.toilink.controller.pub;

import jakarta.validation.Valid;
import kg.toilink.dto.request.RsvpRequest;
import kg.toilink.service.RsvpService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/public/events")
@RequiredArgsConstructor
public class RsvpController {

    private final RsvpService rsvpService;

    @PostMapping("/{slug}/rsvp")
    public Map<String, String> rsvp(@PathVariable String slug,
                                    @Valid @RequestBody RsvpRequest request) {
        RsvpService.RsvpResult result = rsvpService.rsvp(slug, request);
        String message = switch (result.status()) {
            case "ATTENDING" -> "Great! Your attendance is confirmed.";
            case "DECLINED"  -> "Thank you for letting us know.";
            case "MAYBE"     -> "Got it! We will keep your spot tentative.";
            default          -> "Response recorded.";
        };
        return Map.of(
                "status", result.status(),
                "message", message,
                "guestToken", result.guestToken().toString()
        );
    }
}
