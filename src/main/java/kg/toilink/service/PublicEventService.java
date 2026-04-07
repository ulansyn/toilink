package kg.toilink.service;

import kg.toilink.dto.response.EventPublicResponse;
import kg.toilink.entity.Event;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicEventService {

    private final EventRepository eventRepository;

    @Transactional(readOnly = true)
    public EventPublicResponse findBySlug(String slug) {
        Event event = eventRepository.findBySlug(slug)
                .orElseThrow(() -> NotFoundException.eventBySlug(slug));

        String blocksSchema = event.getTemplate() != null
                ? event.getTemplate().getBlocksSchema()
                : null;

        return EventPublicResponse.from(event, blocksSchema);
    }
}
