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
        String status = rsvpService.rsvp(slug, request);
        String message = switch (status) {
            case "ATTENDING" -> "Great! Your attendance is confirmed.";
            case "DECLINED"  -> "Thank you for letting us know.";
            case "MAYBE"     -> "Got it! We will keep your spot tentative.";
            default          -> "Response recorded.";
        };
        return Map.of("status", status, "message", message);
    }
}
