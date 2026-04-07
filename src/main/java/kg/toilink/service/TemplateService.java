package kg.toilink.service;

import kg.toilink.dto.response.TemplateResponse;
import kg.toilink.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TemplateService {

    private final TemplateRepository templateRepository;

    @Transactional(readOnly = true)
    public List<TemplateResponse> findAll() {
        return templateRepository.findAllByIsActiveTrueOrderBySortOrderAsc()
                .stream()
                .map(TemplateResponse::from)
                .toList();
    }
}
