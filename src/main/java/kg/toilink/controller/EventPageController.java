package kg.toilink.controller;

import jakarta.servlet.http.HttpServletRequest;
import kg.toilink.entity.Event;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
@RequiredArgsConstructor
public class EventPageController {

    private final EventRepository eventRepository;

    @GetMapping("/e/{slug}")
    public String eventPage(@PathVariable String slug, Model model, HttpServletRequest request) {
        Event event = eventRepository.findBySlug(slug)
                .orElseThrow(() -> NotFoundException.eventBySlug(slug));

        String baseUrl = request.getScheme() + "://" + request.getServerName()
                + (request.getServerPort() != 80 && request.getServerPort() != 443
                        ? ":" + request.getServerPort() : "");

        String ogImage = (event.getCoverImageUrl() != null && !event.getCoverImageUrl().isBlank())
                ? event.getCoverImageUrl()
                : baseUrl + "/images/og-placeholder.svg";

        String ogDescription = buildDescription(event);

        model.addAttribute("event", event);
        model.addAttribute("ogImage", ogImage);
        model.addAttribute("ogDescription", ogDescription);
        model.addAttribute("ogUrl", baseUrl + "/e/" + slug);

        // Pass serializable fields for JS injection (avoid lazy entity serialization)
        model.addAttribute("eventPerson1", event.getPerson1() != null ? event.getPerson1() : "");
        model.addAttribute("eventPerson2", event.getPerson2() != null ? event.getPerson2() : "");
        model.addAttribute("eventDate", event.getEventDate() != null ? event.getEventDate().toString() : "");
        model.addAttribute("eventBlocksConfig", event.getBlocksConfig() != null ? event.getBlocksConfig() : "{}");
        model.addAttribute("eventSlug", event.getSlug());
        model.addAttribute("eventStatus", event.getStatus() != null ? event.getStatus() : "");
        model.addAttribute("eventRsvpDeadline", event.getRsvpDeadline() != null ? event.getRsvpDeadline().toString() : "");

        // Route to template-specific Thymeleaf view by templatePath
        String templatePath = (event.getTemplate() != null) ? event.getTemplate().getTemplatePath() : null;
        if ("template-1".equals(templatePath)) {
            return "event-wedding";
        }
        if ("template-2".equals(templatePath)) {
            return "event-minimal";
        }
        return "event-og";
    }

    private String buildDescription(Event event) {
        StringBuilder sb = new StringBuilder();
        if (event.getEventDate() != null) {
            sb.append(event.getEventDate().toLocalDate());
        }
        if (event.getLocation() != null && !event.getLocation().isBlank()) {
            if (!sb.isEmpty()) sb.append(" • ");
            sb.append(event.getLocation());
        }
        return sb.isEmpty() ? event.getTitle() : sb.toString();
    }
}
