package kg.toilink.service;

import kg.toilink.entity.Event;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicEventServiceTest {

    @Mock
    private EventRepository eventRepository;

    @InjectMocks
    private PublicEventService publicEventService;

    @Test
    void allowsDraftPreviewWithMatchingToken() {
        UUID previewToken = UUID.randomUUID();
        Event event = Event.builder()
                .slug("test-slug")
                .status("DRAFT")
                .previewToken(previewToken)
                .title("Test")
                .build();

        when(eventRepository.findWithTemplateBySlug("test-slug")).thenReturn(Optional.of(event));

        assertDoesNotThrow(() -> publicEventService.findAccessibleEvent("test-slug", previewToken));
    }

    @Test
    void blocksDraftWithoutPreviewToken() {
        Event event = Event.builder()
                .slug("test-slug")
                .status("DRAFT")
                .previewToken(UUID.randomUUID())
                .title("Test")
                .build();

        when(eventRepository.findWithTemplateBySlug("test-slug")).thenReturn(Optional.of(event));

        assertThrows(NotFoundException.class, () -> publicEventService.findAccessibleEvent("test-slug", null));
    }
}
