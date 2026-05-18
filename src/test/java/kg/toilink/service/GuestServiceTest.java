package kg.toilink.service;

import kg.toilink.dto.request.UpdateGuestRequest;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.RsvpResponseRepository;
import kg.toilink.repository.SeatingTableRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GuestServiceTest {

    @Mock
    private GuestRepository guestRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private RsvpResponseRepository rsvpResponseRepository;

    @Mock
    private SeatingTableRepository seatingTableRepository;

    @Mock
    private UserService userService;

    @Mock
    private PricingService pricingService;

    @InjectMocks
    private GuestService guestService;

    @Test
    void updateRejectsRelatedGuestFromAnotherEvent() {
        User owner = User.builder().id(1L).phone("+996700000000").build();
        Event event = Event.builder().id(10L).user(owner).build();
        Event otherEvent = Event.builder().id(20L).user(owner).build();
        Guest guest = Guest.builder().id(100L).event(event).name("Айбек").build();
        Guest unrelated = Guest.builder().id(200L).event(otherEvent).name("Чужой гость").build();

        when(userService.findByPhone("+996700000000")).thenReturn(Optional.of(owner));
        when(eventRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(event));
        when(guestRepository.findById(100L)).thenReturn(Optional.of(guest));
        when(guestRepository.findById(200L)).thenReturn(Optional.of(unrelated));

        UpdateGuestRequest request = new UpdateGuestRequest(
                "Айбек",
                "+996700000000",
                null,
                "SHARED",
                200L,
                "FRIEND",
                null,
                null
        );

        assertThrows(BadRequestException.class,
                () -> guestService.updateGuest(10L, 100L, request, "+996700000000"));
        verify(guestRepository, never()).save(guest);
    }

    @Test
    void updateRejectsSelfRelation() {
        User owner = User.builder().id(1L).phone("+996700000000").build();
        Event event = Event.builder().id(10L).user(owner).build();
        Guest guest = Guest.builder().id(100L).event(event).name("Айбек").build();

        when(userService.findByPhone("+996700000000")).thenReturn(Optional.of(owner));
        when(eventRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(event));
        when(guestRepository.findById(100L)).thenReturn(Optional.of(guest));

        UpdateGuestRequest request = new UpdateGuestRequest(
                "Айбек",
                "+996700000000",
                null,
                "SHARED",
                100L,
                "FRIEND",
                null,
                null
        );

        assertThrows(BadRequestException.class,
                () -> guestService.updateGuest(10L, 100L, request, "+996700000000"));
        verify(guestRepository, never()).save(guest);
    }

    @Test
    void updateRejectsDeletedGuest() {
        User owner = User.builder().id(1L).phone("+996700000000").build();
        Event event = Event.builder().id(10L).user(owner).build();
        Guest guest = Guest.builder().id(100L).event(event).name("Айбек").build();
        guest.setDeletedAt(java.time.LocalDateTime.now());

        when(userService.findByPhone("+996700000000")).thenReturn(Optional.of(owner));
        when(eventRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(event));
        when(guestRepository.findById(100L)).thenReturn(Optional.of(guest));

        UpdateGuestRequest request = new UpdateGuestRequest(
                "Айбек",
                "+996700000000",
                null,
                "SHARED",
                null,
                null,
                null,
                null
        );

        assertThrows(kg.toilink.exception.NotFoundException.class,
                () -> guestService.updateGuest(10L, 100L, request, "+996700000000"));
        verify(guestRepository, never()).save(guest);
    }

    @Test
    void updateRejectsInvalidRsvpStatus() {
        User owner = User.builder().id(1L).phone("+996700000000").build();
        Event event = Event.builder().id(10L).user(owner).build();
        Guest guest = Guest.builder().id(100L).event(event).name("Айбек").build();

        when(userService.findByPhone("+996700000000")).thenReturn(Optional.of(owner));
        when(eventRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(event));
        when(guestRepository.findById(100L)).thenReturn(Optional.of(guest));

        UpdateGuestRequest request = new UpdateGuestRequest(
                "Айбек",
                "+996700000000",
                null,
                "SHARED",
                null,
                null,
                "YES",
                null
        );

        assertThrows(BadRequestException.class,
                () -> guestService.updateGuest(10L, 100L, request, "+996700000000"));
        verify(guestRepository, never()).save(guest);
    }
}
