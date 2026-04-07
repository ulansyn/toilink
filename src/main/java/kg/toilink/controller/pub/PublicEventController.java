package kg.toilink.controller.pub;

import kg.toilink.dto.response.EventPublicResponse;
import kg.toilink.service.PublicEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/events")
@RequiredArgsConstructor
public class PublicEventController {

    private final PublicEventService publicEventService;

    @GetMapping("/{slug}")
    public EventPublicResponse getBySlug(@PathVariable String slug) {
        return publicEventService.findBySlug(slug);
    }
}
