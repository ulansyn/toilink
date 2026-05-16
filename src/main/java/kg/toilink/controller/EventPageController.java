package kg.toilink.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import kg.toilink.entity.Event;
import kg.toilink.service.PublicEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class EventPageController {

    private final PublicEventService publicEventService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/e/{slug}")
    public String eventPage(@PathVariable String slug,
                            @RequestParam(name = "preview", required = false) UUID previewToken,
                            Model model,
                            HttpServletRequest request) {
        return render(slug, null, previewToken, model, request);
    }

    @GetMapping("/e/{slug}/{groupCode}")
    public String eventPageWithGroup(@PathVariable String slug,
                                     @PathVariable String groupCode,
                                     @RequestParam(name = "preview", required = false) UUID previewToken,
                                     Model model,
                                     HttpServletRequest request) {
        return render(slug, groupCode, previewToken, model, request);
    }

    private String render(String slug, String groupCode, UUID previewToken,
                          Model model, HttpServletRequest request) {
        Event event = publicEventService.findAccessibleEvent(slug, previewToken);
        boolean previewAccess = !publicEventService.isPubliclyVisible(event)
                && publicEventService.hasPreviewAccess(event, previewToken);

        String baseUrl = request.getScheme() + "://" + request.getServerName()
                + (request.getServerPort() != 80 && request.getServerPort() != 443
                        ? ":" + request.getServerPort() : "");

        String ogImage = (event.getCoverImageUrl() != null && !event.getCoverImageUrl().isBlank())
                ? event.getCoverImageUrl()
                : baseUrl + "/images/og-placeholder.svg";

        String ogDescription = buildDescription(event);

        // Validate groupCode against event.guestGroups (fallback to null = "общая ссылка").
        String prefilledGroupCode = validateGroupCode(groupCode, event.getGuestGroups());

        String pathSuffix = prefilledGroupCode != null ? "/" + prefilledGroupCode : "";

        model.addAttribute("event", event);
        model.addAttribute("ogImage", ogImage);
        model.addAttribute("ogDescription", ogDescription);
        model.addAttribute("ogUrl", baseUrl + "/e/" + slug + pathSuffix
                + (previewAccess ? "?preview=" + previewToken : ""));

        // Pass serializable fields for JS injection (avoid lazy entity serialization)
        model.addAttribute("eventPerson1", event.getPerson1() != null ? event.getPerson1() : "");
        model.addAttribute("eventPerson2", event.getPerson2() != null ? event.getPerson2() : "");
        model.addAttribute("eventDate", event.getEventDate() != null ? event.getEventDate().toString() : "");
        model.addAttribute("eventBlocksConfig", event.getBlocksConfig() != null ? event.getBlocksConfig() : "{}");
        model.addAttribute("eventSlug", event.getSlug());
        model.addAttribute("eventStatus", event.getStatus() != null ? event.getStatus() : "");
        model.addAttribute("eventRsvpDeadline", event.getRsvpDeadline() != null ? event.getRsvpDeadline().toString() : "");
        model.addAttribute("eventGuestGroups", event.getGuestGroups() != null ? event.getGuestGroups() : "[]");
        model.addAttribute("prefilledGroupCode", prefilledGroupCode != null ? prefilledGroupCode : "");

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

    /** Returns the input code only if it matches a code in event.guestGroups JSON; otherwise null. */
    private String validateGroupCode(String groupCode, String guestGroupsJson) {
        if (groupCode == null || groupCode.isBlank() || guestGroupsJson == null) return null;
        try {
            JsonNode arr = objectMapper.readTree(guestGroupsJson);
            if (!arr.isArray()) return null;
            for (JsonNode g : arr) {
                JsonNode code = g.get("code");
                if (code != null && groupCode.equals(code.asText())) return groupCode;
            }
        } catch (Exception ignored) {}
        return null;
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
