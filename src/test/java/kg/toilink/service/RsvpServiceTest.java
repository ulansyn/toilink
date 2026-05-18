package kg.toilink.service;

import kg.toilink.dto.request.RsvpRequest;
import kg.toilink.entity.Event;
import kg.toilink.entity.Guest;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.RsvpResponseRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RsvpServiceTest {

    @Mock
    private EventRepository eventRepository;

    @Mock
    private GuestRepository guestRepository;

    @Mock
    private RsvpResponseRepository rsvpResponseRepository;

    @InjectMocks
    private RsvpService rsvpService;

    @Test
    void requiresNameForPublicLinkResponses() {
        Event event = Event.builder()
                .id(1L)
                .slug("event")
                .status("PUBLISHED")
                .title("Event")
                .build();

        when(eventRepository.findBySlug("event")).thenReturn(Optional.of(event));

        RsvpRequest request = new RsvpRequest(null, "   ", null, null, null, "ATTENDING", 1, null);

        assertThrows(BadRequestException.class, () -> rsvpService.rsvp("event", request));
    }

    @Test
    void createsPublicLinkGuestWithTokenForRepeatSubmissions() {
        Event event = Event.builder()
                .id(1L)
                .slug("event")
                .status("PUBLISHED")
                .title("Event")
                .build();

        when(eventRepository.findBySlug("event")).thenReturn(Optional.of(event));
        when(guestRepository.save(any(Guest.class))).thenAnswer(invocation -> {
            Guest guest = invocation.getArgument(0);
            guest.setId(10L);
            return guest;
        });
        when(rsvpResponseRepository.findByGuestIdAndEventId(10L, 1L)).thenReturn(Optional.empty());

        RsvpService.RsvpResult result = rsvpService.rsvp("event",
                new RsvpRequest(null, "Айжан", null, null, null, "ATTENDING", 2, "Приду"));

        ArgumentCaptor<Guest> guestCaptor = ArgumentCaptor.forClass(Guest.class);
        verify(guestRepository).save(guestCaptor.capture());
        Guest savedGuest = guestCaptor.getValue();

        assertEquals("PUBLIC_LINK", savedGuest.getSource());
        assertEquals("Айжан", savedGuest.getName());
        assertNotNull(savedGuest.getToken());
        assertEquals(savedGuest.getToken(), result.guestToken());
    }

    @Test
    void rejectsDeletedGuestToken() {
        UUID token = UUID.randomUUID();
        Event event = Event.builder()
                .id(1L)
                .slug("event")
                .status("PUBLISHED")
                .title("Event")
                .build();

        when(eventRepository.findBySlug("event")).thenReturn(Optional.of(event));
        when(guestRepository.findByTokenAndDeletedAtIsNull(token)).thenReturn(Optional.empty());

        RsvpRequest request = new RsvpRequest(token, null, null, null, null, "ATTENDING", 1, null);

        assertThrows(BadRequestException.class, () -> rsvpService.rsvp("event", request));
    }

    @Test
    void rejectsUnknownGroupCodeFromPublicRequest() {
        Event event = Event.builder()
                .id(1L)
                .slug("event")
                .status("PUBLISHED")
                .title("Event")
                .guestGroups("[{\"code\":\"bride\",\"label\":\"Bride\"}]")
                .build();

        when(eventRepository.findBySlug("event")).thenReturn(Optional.of(event));

        RsvpRequest request = new RsvpRequest(null, "Айжан", null, "random", null, "ATTENDING", 1, null);

        assertThrows(BadRequestException.class, () -> rsvpService.rsvp("event", request));
        verify(guestRepository, never()).save(any(Guest.class));
    }

    @Test
    void acceptsKnownGroupCodeFromPublicRequest() {
        Event event = Event.builder()
                .id(1L)
                .slug("event")
                .status("PUBLISHED")
                .title("Event")
                .guestGroups("[{\"code\":\"bride\",\"label\":\"Bride\"}]")
                .build();

        when(eventRepository.findBySlug("event")).thenReturn(Optional.of(event));
        when(guestRepository.save(any(Guest.class))).thenAnswer(invocation -> {
            Guest guest = invocation.getArgument(0);
            guest.setId(10L);
            return guest;
        });
        when(rsvpResponseRepository.findByGuestIdAndEventId(10L, 1L)).thenReturn(Optional.empty());

        rsvpService.rsvp("event", new RsvpRequest(null, "Айжан", null, "bride", null, "ATTENDING", 1, null));

        ArgumentCaptor<Guest> guestCaptor = ArgumentCaptor.forClass(Guest.class);
        verify(guestRepository).save(guestCaptor.capture());
        assertEquals("bride", guestCaptor.getValue().getSide());
    }

    @Test
    void rejectsOversizedGroupSize() {
        Event event = Event.builder()
                .id(1L)
                .slug("event")
                .status("PUBLISHED")
                .title("Event")
                .build();

        when(eventRepository.findBySlug("event")).thenReturn(Optional.of(event));

        RsvpRequest request = new RsvpRequest(null, "Айжан", null, null, null, "ATTENDING", 21, null);

        assertThrows(BadRequestException.class, () -> rsvpService.rsvp("event", request));
        verify(guestRepository, never()).save(any(Guest.class));
    }
}
