package kg.toilink.service;

import kg.toilink.dto.request.RsvpRequest;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.entity.RsvpResponse;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.RsvpResponseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class RsvpService {

    private final EventRepository eventRepository;
    private final GuestRepository guestRepository;
    private final RsvpResponseRepository rsvpResponseRepository;

    @Transactional
    public String rsvp(String slug, RsvpRequest req) {
        Event event = eventRepository.findBySlug(slug)
                .orElseThrow(() -> NotFoundException.eventBySlug(slug));

        if ("CLOSED".equals(event.getStatus())) {
            throw new BadRequestException("Event is closed for responses");
        }
        if (event.getRsvpDeadline() != null && LocalDateTime.now().isAfter(event.getRsvpDeadline())) {
            throw new BadRequestException("RSVP deadline has passed");
        }

        Guest guest = resolveGuest(event, req);

        rsvpResponseRepository.findByGuestIdAndEventId(guest.getId(), event.getId())
                .ifPresentOrElse(
                        existing -> {
                            existing.setStatus(req.status());
                            existing.setGroupSize(req.groupSize() > 0 ? req.groupSize() : 1);
                            existing.setComment(req.comment());
                            rsvpResponseRepository.save(existing);
                        },
                        () -> rsvpResponseRepository.save(RsvpResponse.builder()
                                .guest(guest)
                                .event(event)
                                .status(req.status())
                                .groupSize(req.groupSize() > 0 ? req.groupSize() : 1)
                                .comment(req.comment())
                                .build())
                );

        return req.status();
    }

    private Guest resolveGuest(Event event, RsvpRequest req) {
        if (req.guestToken() != null) {
            Guest guest = guestRepository.findByToken(req.guestToken())
                    .orElseThrow(() -> new BadRequestException("Invalid guest token"));
            if (!guest.getEvent().getId().equals(event.getId())) {
                throw new BadRequestException("Guest token does not belong to this event");
            }
            return guest;
        }

        // Anonymous guest — create on the fly
        Guest guest = Guest.builder()
                .event(event)
                .name(req.name())
                .build();
        return guestRepository.save(guest);
    }
}
