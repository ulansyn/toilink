package kg.toilink.controller.pub;

import kg.toilink.dto.response.TemplateResponse;
import kg.toilink.service.TemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/templates")
@RequiredArgsConstructor
public class PublicTemplateController {

    private final TemplateService templateService;

    @GetMapping
    public List<TemplateResponse> getAll() {
        return templateService.findAll();
    }
}
