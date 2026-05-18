package kg.toilink.service;

import kg.toilink.dto.request.CreateGuestRequest;
import kg.toilink.dto.request.UpdateGuestRequest;
import kg.toilink.dto.response.GuestResponse;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.entity.RsvpResponse;
import kg.toilink.entity.SeatingTable;
import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import java.time.LocalDateTime;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.RsvpResponseRepository;
import kg.toilink.repository.SeatingTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GuestService {

    private final GuestRepository guestRepository;
    private final EventRepository eventRepository;
    private final RsvpResponseRepository rsvpResponseRepository;
    private final SeatingTableRepository seatingTableRepository;
    private final UserService userService;
    private final PricingService pricingService;

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

        Set<Long> tableIds = guests.stream()
                .map(Guest::getTableId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> tableNameMap = tableIds.isEmpty() ? Map.of() :
                seatingTableRepository.findAllById(tableIds).stream()
                        .collect(Collectors.toMap(SeatingTable::getId, SeatingTable::getName));

        return guests.stream()
                .map(g -> GuestResponse.from(
                        g,
                        statusByGuest.get(g.getId()),
                        g.getRelatedToId() != null ? nameById.get(g.getRelatedToId()) : null,
                        g.getTableId() != null ? tableNameMap.get(g.getTableId()) : null))
                .toList();
    }

    @Transactional
    public GuestResponse addGuest(Long eventId, CreateGuestRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);
        int guestsToAdd = req.companionName() != null && !req.companionName().isBlank() ? 2 : 1;
        checkGuestLimit(event, guestsToAdd);
        String side = req.side() != null ? req.side() : "SHARED";
        String source = shouldCreatePersonalLink(event, req) ? "PERSONAL_LINK" : "MANUAL";

        Guest primary = guestRepository.save(Guest.builder()
                .event(event)
                .name(req.name())
                .phone(req.phone())
                .source(source)
                .notes(req.notes())
                .side(side)
                .build());

        if (req.rsvpStatus() != null && !req.rsvpStatus().isBlank()) {
            rsvpResponseRepository.save(RsvpResponse.builder()
                    .guest(primary).event(event).status(req.rsvpStatus()).groupSize(1).build());
        }

        if (req.companionName() != null && !req.companionName().isBlank()) {
            Guest companion = guestRepository.save(Guest.builder()
                    .event(event)
                    .name(req.companionName().trim())
                    .source("MANUAL")
                    .side(side)
                    .relatedToId(primary.getId())
                    .relationType("SPOUSE")
                    .build());
            if (req.rsvpStatus() != null && !req.rsvpStatus().isBlank()) {
                rsvpResponseRepository.save(RsvpResponse.builder()
                        .guest(companion).event(event).status(req.rsvpStatus()).groupSize(1).build());
            }
            primary.setRelatedToId(companion.getId());
            primary.setRelationType("SPOUSE");
            primary = guestRepository.save(primary);
        }

        return GuestResponse.from(primary, req.rsvpStatus(), resolveRelatedName(primary.getRelatedToId()), null);
    }

    @Transactional
    public GuestResponse updateGuest(Long eventId, Long guestId, UpdateGuestRequest req, String phone) {
        Event event = verifyOwnership(eventId, phone);
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
        guest.setTableId(validateTableAssignment(event, req.tableId()));
        Guest saved = guestRepository.save(guest);

        String finalStatus = applyRsvpStatus(saved, event, req.rsvpStatus());
        String tableName = saved.getTableId() != null ?
                seatingTableRepository.findById(saved.getTableId()).map(SeatingTable::getName).orElse(null) : null;
        return GuestResponse.from(saved, finalStatus, resolveRelatedName(saved.getRelatedToId()), tableName);
    }

    private String applyRsvpStatus(Guest guest, Event event, String rsvpStatus) {
        if (rsvpStatus == null) {
            // null = don't change; return current status
            return rsvpResponseRepository.findByGuestIdAndEventId(guest.getId(), event.getId())
                    .map(RsvpResponse::getStatus).orElse(null);
        }
        if ("NONE".equals(rsvpStatus)) {
            rsvpResponseRepository.findByGuestIdAndEventId(guest.getId(), event.getId())
                    .ifPresent(rsvpResponseRepository::delete);
            return null;
        }
        rsvpResponseRepository.findByGuestIdAndEventId(guest.getId(), event.getId())
                .ifPresentOrElse(
                        r -> { r.setStatus(rsvpStatus); rsvpResponseRepository.save(r); },
                        () -> rsvpResponseRepository.save(RsvpResponse.builder()
                                .guest(guest).event(event).status(rsvpStatus).groupSize(1).build())
                );
        return rsvpStatus;
    }

    private String resolveRelatedName(Long relatedToId) {
        if (relatedToId == null) return null;
        return guestRepository.findById(relatedToId).map(Guest::getName).orElse(null);
    }

    @Transactional
    public void deleteGuest(Long eventId, Long guestId, String phone) {
        verifyOwnership(eventId, phone);
        Guest guest = guestRepository.findById(guestId)
                .filter(g -> g.getDeletedAt() == null)
                .orElseThrow(() -> NotFoundException.guest(guestId));
        if (!guest.getEvent().getId().equals(eventId)) {
            throw NotFoundException.guest(guestId);
        }
        guest.setDeletedAt(LocalDateTime.now());
        guestRepository.save(guest);
    }

    private void checkGuestLimit(Event event, int guestsToAdd) {
        long current = guestRepository.countByEventId(event.getId());
        pricingService.requireGuestCapacity(event.getPlanCode(), current, guestsToAdd);
    }

    private boolean shouldCreatePersonalLink(Event event, CreateGuestRequest req) {
        return !Boolean.FALSE.equals(req.personalInvite())
                && pricingService.allowsPersonalLinks(event.getPlanCode());
    }

    private Long validateTableAssignment(Event event, Long tableId) {
        if (tableId == null) return null;
        pricingService.requireSeating(event.getPlanCode());
        SeatingTable table = seatingTableRepository.findById(tableId)
                .orElseThrow(() -> new BadRequestException("Стол не найден"));
        if (!table.getEvent().getId().equals(event.getId())) {
            throw new BadRequestException("Стол не принадлежит этому событию");
        }
        return tableId;
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
