package kg.toilink.service;

import kg.toilink.dto.request.CreateGuestRequest;
import kg.toilink.dto.request.UpdateGuestRequest;
import kg.toilink.dto.response.GuestResponse;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.entity.RsvpResponse;
import kg.toilink.entity.User;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.RsvpResponseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuestService {

    private final GuestRepository guestRepository;
    private final EventRepository eventRepository;
    private final RsvpResponseRepository rsvpResponseRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<GuestResponse> findAllByEvent(Long eventId, String phone) {
        verifyOwnership(eventId, phone);

        List<Guest> guests = guestRepository.findAllByEventId(eventId);

        Map<Long, String> statusByGuest = rsvpResponseRepository.findAllByEventId(eventId).stream()
                .collect(Collectors.toMap(
                        r -> r.getGuest().getId(),
                        RsvpResponse::getStatus,
                        (a, b) -> b));

        Map<Long, String> nameById = guests.stream()
                .filter(g -> g.getName() != null)
                .collect(Collectors.toMap(Guest::getId, Guest::getName, (a, b) -> a));

        return guests.stream()
                .map(g -> GuestResponse.from(
                        g,
                        statusByGuest.get(g.getId()),
                        g.getRelatedToId() != null ? nameById.get(g.getRelatedToId()) : null))
                .toList();
    }

    @Transactional
    public GuestResponse addGuest(Long eventId, CreateGuestRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);

        Guest guest = Guest.builder()
                .event(event)
                .name(req.name())
                .phone(req.phone())
                .source(Boolean.TRUE.equals(req.personalInvite()) ? "PERSONAL_LINK" : "MANUAL")
                .notes(req.notes())
                .side(req.side() != null ? req.side() : "SHARED")
                .relatedToId(req.relatedToId())
                .relationType(req.relationType())
                .build();

        Guest saved = guestRepository.save(guest);
        String relatedToName = resolveRelatedName(saved.getRelatedToId());
        return GuestResponse.from(saved, null, relatedToName);
    }

    @Transactional
    public GuestResponse updateGuest(Long eventId, Long guestId, UpdateGuestRequest req, String phone) {
        verifyOwnership(eventId, phone);
        Guest guest = guestRepository.findById(guestId)
                .orElseThrow(() -> NotFoundException.guest(guestId));
        if (!guest.getEvent().getId().equals(eventId)) {
            throw NotFoundException.guest(guestId);
        }

        if (req.name() != null && !req.name().isBlank()) guest.setName(req.name().trim());
        guest.setPhone(req.phone() != null && !req.phone().isBlank() ? req.phone().trim() : null);
        guest.setNotes(req.notes() != null && !req.notes().isBlank() ? req.notes().trim() : null);
        if (req.side() != null) guest.setSide(req.side());
        guest.setRelatedToId(req.relatedToId());
        guest.setRelationType(req.relatedToId() != null ? req.relationType() : null);

        Guest saved = guestRepository.save(guest);
        String relatedToName = resolveRelatedName(saved.getRelatedToId());
        return GuestResponse.from(saved, null, relatedToName);
    }

    private String resolveRelatedName(Long relatedToId) {
        if (relatedToId == null) return null;
        return guestRepository.findById(relatedToId).map(Guest::getName).orElse(null);
    }

    @Transactional
    public void deleteGuest(Long eventId, Long guestId, String phone) {
        verifyOwnership(eventId, phone);
        Guest guest = guestRepository.findById(guestId)
                .orElseThrow(() -> NotFoundException.guest(guestId));
        if (!guest.getEvent().getId().equals(eventId)) {
            throw NotFoundException.guest(guestId);
        }
        guestRepository.delete(guest);
    }

    private Event verifyOwnership(Long eventId, String phone) {
        User user = userService.findByPhone(phone)
                .orElseThrow(() -> new NotFoundException("User not found for phone: " + phone));
        Event event = eventRepository.findByIdAndDeletedAtIsNull(eventId)
                .orElseThrow(() -> NotFoundException.event(eventId));
        if (event.getUser() == null || !event.getUser().getId().equals(user.getId())) {
            throw NotFoundException.event(eventId);
        }
        return event;
    }
}
