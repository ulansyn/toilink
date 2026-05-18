package kg.toilink.service;

import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @Test
    void newPublicLoginAlwaysCreatesClientUser() {
        when(userRepository.findByPhoneAndDeletedAtIsNull("+996700000000")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("pass1234")).thenReturn("hash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User user = userService.loginOrRegister("+996700000000", "pass1234", "127.0.0.1");

        assertEquals("CLIENT", user.getRole());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertEquals("CLIENT", userCaptor.getValue().getRole());
    }

    @Test
    void loginNormalizesNationalKgPhoneBeforeLookupAndSave() {
        when(userRepository.findByPhoneAndDeletedAtIsNull("+996700000000")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("pass1234")).thenReturn("hash");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User user = userService.loginOrRegister("0700 000 000", "pass1234", "127.0.0.1");

        assertEquals("+996700000000", user.getPhone());
        verify(userRepository).findByPhoneAndDeletedAtIsNull("+996700000000");
    }

    @Test
    void loginRejectsInvalidPhoneBeforeCreatingUser() {
        assertThrows(BadRequestException.class,
                () -> userService.loginOrRegister("abc", "pass1234", "127.0.0.1"));
    }

    @Test
    void loginCanFindLegacyPhoneStoredWithoutPlus() {
        User existing = User.builder()
                .phone("996700000000")
                .passwordHash("hash")
                .role("CLIENT")
                .build();
        existing.setActive(true);
        when(userRepository.findByPhoneAndDeletedAtIsNull("+996700000000")).thenReturn(Optional.empty());
        when(userRepository.findByPhoneAndDeletedAtIsNull("996700000000")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("pass1234", "hash")).thenReturn(true);
        when(userRepository.save(existing)).thenReturn(existing);

        User user = userService.loginOrRegister("996700000000", "pass1234", "127.0.0.1");

        assertEquals("996700000000", user.getPhone());
    }
}
