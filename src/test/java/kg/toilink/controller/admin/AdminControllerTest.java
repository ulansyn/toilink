package kg.toilink.controller.admin;

import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.AdminAuditLogRepository;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.PaymentRepository;
import kg.toilink.repository.RsvpResponseRepository;
import kg.toilink.repository.TemplateRepository;
import kg.toilink.repository.UserRepository;
import kg.toilink.service.LandingSettingsService;
import kg.toilink.service.PricingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.userdetails.UserDetails;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private GuestRepository guestRepository;

    @Mock
    private RsvpResponseRepository rsvpResponseRepository;

    @Mock
    private TemplateRepository templateRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private AdminAuditLogRepository auditLogRepository;

    @Mock
    private LandingSettingsService landingSettingsService;

    @Mock
    private PricingService pricingService;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private AdminController adminController;

    @Test
    void managerCannotPromoteUsersToSuperAdmin() {
        User manager = User.builder()
                .id(1L)
                .phone("+996700000001")
                .role("MANAGER")
                .build();
        manager.setActive(true);
        UserDetails principal = org.springframework.security.core.userdetails.User
                .withUsername("+996700000001")
                .password("hash")
                .authorities("ROLE_MANAGER")
                .build();

        when(userRepository.findByPhone("+996700000001")).thenReturn(Optional.of(manager));

        assertThrows(BadRequestException.class, () -> adminController.changeUserRole(
                2L,
                Map.of("role", "SUPERADMIN"),
                principal,
                new MockHttpServletRequest()
        ));
        verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any(User.class));
    }

    @Test
    void userEventsAreFilteredByUserIdNotPhoneSearch() {
        User user = User.builder()
                .id(2L)
                .phone("+996700000002")
                .role("CLIENT")
                .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user));
        when(eventRepository.findAdminByUserId(eq(2L), any())).thenReturn(Page.empty());

        adminController.getUserEvents(2L, 0, 20);

        verify(eventRepository).findAdminByUserId(eq(2L), any());
        verify(eventRepository, never()).searchAdmin(eq("+996700000002"), eq(null), eq(true), any());
    }
}
