package kg.toilink.controller.organizer;

import kg.toilink.dto.response.TemplateResponse;
import kg.toilink.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/organizer/templates")
@RequiredArgsConstructor
public class TemplateController {

    private final TemplateService templateService;

    @GetMapping
    public List<TemplateResponse> getAll() {
        return templateService.findAll();
    }
}
