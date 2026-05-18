package kg.toilink.controller;

import kg.toilink.dto.request.AuthRequest;
import kg.toilink.dto.response.AuthResponse;
import kg.toilink.entity.User;
import kg.toilink.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.context.SecurityContextRepository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserService userService;

    @Mock
    private SecurityContextRepository securityContextRepository;

    @InjectMocks
    private AuthController authController;

    @Test
    void loginSavesSecurityContextExplicitly() {
        User user = User.builder()
                .phone("+996700000000")
                .name("Ulan")
                .role("CLIENT")
                .passwordHash("hash")
                .build();
        UserDetails details = org.springframework.security.core.userdetails.User
                .withUsername("+996700000000")
                .password("hash")
                .authorities("ROLE_CLIENT")
                .build();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        when(userService.loginOrRegister("+996700000000", "pass1234", "127.0.0.1")).thenReturn(user);
        when(userService.loadUserByUsername("+996700000000")).thenReturn(details);

        AuthResponse authResponse = authController.login(
                new AuthRequest("+996700000000", "pass1234"),
                request,
                response
        );

        assertEquals("+996700000000", authResponse.phone());
        ArgumentCaptor<SecurityContext> contextCaptor = ArgumentCaptor.forClass(SecurityContext.class);
        verify(securityContextRepository).saveContext(contextCaptor.capture(), same(request), same(response));
        assertNotNull(contextCaptor.getValue().getAuthentication());
        assertEquals("+996700000000", contextCaptor.getValue().getAuthentication().getName());
    }
}
