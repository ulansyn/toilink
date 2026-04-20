package kg.toilink.service;

import kg.toilink.dto.response.EventPublicResponse;
import kg.toilink.entity.Event;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PublicEventService {

    private final EventRepository eventRepository;

    @Transactional(readOnly = true)
    public EventPublicResponse findBySlug(String slug, UUID previewToken) {
        Event event = findAccessibleEvent(slug, previewToken);

        String blocksSchema = event.getTemplate() != null
                ? event.getTemplate().getBlocksSchema()
                : null;

        return EventPublicResponse.from(event, blocksSchema);
    }

    @Transactional(readOnly = true)
    public Event findAccessibleEvent(String slug, UUID previewToken) {
        Event event = eventRepository.findWithTemplateBySlug(slug)
                .orElseThrow(() -> NotFoundException.eventBySlug(slug));

        if (!isPubliclyVisible(event) && !hasPreviewAccess(event, previewToken)) {
            throw NotFoundException.eventBySlug(slug);
        }

        return event;
    }

    public boolean isPubliclyVisible(Event event) {
        return "PUBLISHED".equals(event.getStatus()) || "CLOSED".equals(event.getStatus());
    }

    public boolean hasPreviewAccess(Event event, UUID previewToken) {
        return previewToken != null
                && event.getPreviewToken() != null
                && event.getPreviewToken().equals(previewToken);
    }
}
