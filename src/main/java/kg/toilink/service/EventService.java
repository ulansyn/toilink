package kg.toilink.service;

import kg.toilink.dto.request.CreateEventRequest;
import kg.toilink.dto.request.UpdateEventRequest;
import kg.toilink.dto.response.EventDashboardResponse;
import kg.toilink.dto.response.EventResponse;
import kg.toilink.dto.response.EventStatsResponse;
import kg.toilink.entity.Event;
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

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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

    @Transactional(readOnly = true)
    public List<EventDashboardResponse> findDashboardByUser(String phone) {
        List<EventResponse> events = findAllByUser(phone);
        if (events.isEmpty()) return List.of();

        Map<Long, EventStatsResponse> statsByEvent = buildStatsByEvent(
                events.stream().map(EventResponse::id).toList()
        );

        return events.stream()
                .map(event -> new EventDashboardResponse(
                        event,
                        statsByEvent.getOrDefault(event.id(), new EventStatsResponse(0, 0, 0, 0))
                ))
                .toList();
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
        return buildStats(event.getId());
    }

    private Event getEventForUser(Long id, String phone) {
        User user = userService.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("User not found for phone: " + phone));
        Event event = eventRepository.findByIdAndDeletedAtIsNull(id)
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

    private EventStatsResponse buildStats(Long eventId) {
        long total = guestRepository.countByEventId(eventId);
        long attending = 0;
        long declined = 0;
        long maybe = 0;

        for (RsvpResponseRepository.EventStatusCountView row : rsvpResponseRepository.countStatusesByEventId(eventId)) {
            switch (row.getStatus()) {
                case "ATTENDING" -> attending = row.getTotal();
                case "DECLINED" -> declined = row.getTotal();
                case "MAYBE" -> maybe = row.getTotal();
                default -> {}
            }
        }

        return new EventStatsResponse(total, attending, declined, maybe);
    }

    private Map<Long, EventStatsResponse> buildStatsByEvent(Collection<Long> eventIds) {
        Map<Long, Long> totalsByEvent = new HashMap<>();
        Map<Long, long[]> bucketsByEvent = new HashMap<>();

        for (GuestRepository.EventGuestCountView row : guestRepository.countByEventIds(eventIds)) {
            totalsByEvent.put(row.getEventId(), row.getTotal());
        }

        for (RsvpResponseRepository.EventStatusCountView row : rsvpResponseRepository.countStatusesByEventIds(eventIds)) {
            long[] bucket = bucketsByEvent.computeIfAbsent(row.getEventId(), ignored -> new long[3]);
            switch (row.getStatus()) {
                case "ATTENDING" -> bucket[0] = row.getTotal();
                case "DECLINED" -> bucket[1] = row.getTotal();
                case "MAYBE" -> bucket[2] = row.getTotal();
                default -> {}
            }
        }

        Map<Long, EventStatsResponse> result = new HashMap<>();
        for (Long eventId : eventIds) {
            long[] bucket = bucketsByEvent.getOrDefault(eventId, new long[3]);
            result.put(eventId, new EventStatsResponse(
                    totalsByEvent.getOrDefault(eventId, 0L),
                    bucket[0],
                    bucket[1],
                    bucket[2]
            ));
        }
        return result;
    }
}
