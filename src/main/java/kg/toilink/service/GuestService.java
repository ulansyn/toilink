package kg.toilink.service;

import kg.toilink.dto.request.CreateGuestRequest;
import kg.toilink.dto.response.GuestResponse;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.entity.User;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GuestService {

    private final GuestRepository guestRepository;
    private final EventRepository eventRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<GuestResponse> findAllByEvent(Long eventId, String phone) {
        verifyOwnership(eventId, phone);
        return guestRepository.findAllByEventId(eventId)
                .stream()
                .map(GuestResponse::from)
                .toList();
    }

    @Transactional
    public GuestResponse addGuest(Long eventId, CreateGuestRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);

        Guest guest = Guest.builder()
                .event(event)
                .name(req.name())
                .phone(req.phone())
                .notes(req.notes())
                .build();

        return GuestResponse.from(guestRepository.save(guest));
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
        User user = userService.findOrCreate(phone);
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> NotFoundException.event(eventId));
        if (event.getUser() == null || !event.getUser().getId().equals(user.getId())) {
            throw NotFoundException.event(eventId);
        }
        return event;
    }
}
