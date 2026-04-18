package kg.toilink.service;

import kg.toilink.dto.request.CreateEventRequest;
import kg.toilink.dto.request.UpdateEventRequest;
import kg.toilink.dto.response.EventResponse;
import kg.toilink.dto.response.EventStatsResponse;
import kg.toilink.entity.Event;
import kg.toilink.entity.RsvpResponse;
import kg.toilink.entity.Template;
import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.RsvpResponseRepository;
import kg.toilink.repository.TemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final TemplateRepository templateRepository;
    private final GuestRepository guestRepository;
    private final RsvpResponseRepository rsvpResponseRepository;
    private final UserService userService;
    private final SlugService slugService;

    @Transactional(readOnly = true)
    public List<EventResponse> findAllByUser(String phone) {
        return userService.findByPhone(phone)
                .map(user -> eventRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId())
                        .stream()
                        .map(EventResponse::from)
                        .toList())
                .orElseGet(List::of);
    }

    @Transactional(readOnly = true)
    public EventResponse findById(Long id, String phone) {
        Event event = getEventForUser(id, phone);
        return EventResponse.from(event);
    }

    @Transactional
    public EventResponse create(CreateEventRequest req, String phone) {
        User user = userService.findOrCreate(phone);

        Template template = null;
        if (req.templateId() != null) {
            template = templateRepository.findById(req.templateId())
                    .orElseThrow(() -> NotFoundException.template(req.templateId()));
        }

        String slug = slugService.generate(req.person1(), req.person2());

        Event event = Event.builder()
                .user(user)
                .template(template)
                .title(req.title())
                .person1(req.person1())
                .person2(req.person2())
                .eventDate(req.eventDate())
                .location(req.location())
                .coverImageUrl(req.coverImageUrl())
                .rsvpDeadline(req.rsvpDeadline())
                .language(req.language())
                .blocksConfig(req.blocksConfig())
                .slug(slug)
                .build();

        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public EventResponse update(Long id, UpdateEventRequest req, String phone) {
        Event event = getEventForUser(id, phone);

        if (req.title() != null) event.setTitle(req.title());
        if (req.person1() != null) event.setPerson1(req.person1());
        if (req.person2() != null) event.setPerson2(req.person2());
        if (req.eventDate() != null) event.setEventDate(req.eventDate());
        if (req.location() != null) event.setLocation(req.location());
        if (req.coverImageUrl() != null) event.setCoverImageUrl(req.coverImageUrl());
        if (req.rsvpDeadline() != null) event.setRsvpDeadline(req.rsvpDeadline());
        if (req.language() != null) event.setLanguage(req.language());
        if (req.blocksConfig() != null) event.setBlocksConfig(req.blocksConfig());
        if (req.status() != null) {
            validateStatus(req.status());
            event.setStatus(req.status());
        }

        return EventResponse.from(eventRepository.save(event));
    }

    @Transactional
    public void delete(Long id, String phone) {
        Event event = getEventForUser(id, phone);
        eventRepository.delete(event);
    }

    @Transactional(readOnly = true)
    public EventStatsResponse getStats(Long id, String phone) {
        Event event = getEventForUser(id, phone);
        long total = guestRepository.findAllByEventId(event.getId()).size();

        long attending = 0, declined = 0, maybe = 0;
        for (RsvpResponse r : rsvpResponseRepository.findAllByEventId(event.getId())) {
            switch (r.getStatus()) {
                case "ATTENDING" -> attending++;
                case "DECLINED" -> declined++;
                case "MAYBE" -> maybe++;
                default -> {}
            }
        }
        return new EventStatsResponse(total, attending, declined, maybe);
    }

    private Event getEventForUser(Long id, String phone) {
        User user = userService.findByPhone(phone)
                .orElseThrow(() -> NotFoundException.event(id));
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> NotFoundException.event(id));
        if (event.getUser() == null || !event.getUser().getId().equals(user.getId())) {
            throw NotFoundException.event(id);
        }
        return event;
    }

    private void validateStatus(String status) {
        if (!status.equals("DRAFT") && !status.equals("PUBLISHED") && !status.equals("CLOSED")) {
            throw new BadRequestException("Invalid status: " + status + ". Must be DRAFT, PUBLISHED or CLOSED");
        }
    }
}
