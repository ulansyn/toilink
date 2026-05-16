package kg.toilink.controller.pub;

import kg.toilink.service.LandingSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/public/landing")
@RequiredArgsConstructor
public class LandingController {

    private final LandingSettingsService landingSettingsService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public JsonNode getLanding() throws Exception {
        return objectMapper.readTree(landingSettingsService.getMainContentJson());
    }
}
