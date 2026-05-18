package kg.toilink.service;

import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.UserRepository;
import kg.toilink.util.PhoneUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String phone) throws UsernameNotFoundException {
        User user = findExistingUserByPhone(phone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + phone));
        if (user.getDeletedAt() != null) {
            throw new UsernameNotFoundException("User deleted: " + phone);
        }
        String role = user.getRole() != null ? user.getRole() : "CLIENT";
        return org.springframework.security.core.userdetails.User
                .withUsername(user.getPhone())
                .password(user.getPasswordHash() != null ? user.getPasswordHash() : "")
                .authorities("ROLE_" + role)
                .disabled(!user.isActive())
                .build();
    }

    /**
     * Login or register in one step:
     * - New phone → create user with password, return user
     * - Existing user, no password yet → set password, return user
     * - Existing user, wrong password → throw BadRequestException
     * - Existing user, correct password → return user
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public User loginOrRegister(String phone, String rawPassword) {
        return loginOrRegister(phone, rawPassword, null);
    }

    @Transactional(noRollbackFor = BadRequestException.class)
    public User loginOrRegister(String phone, String rawPassword, String ip) {
        String normalizedPhone = normalizeLoginPhone(phone);
        Optional<User> existing = findExistingUserByPhone(phone);

        if (existing.isEmpty()) {
            if (rawPassword == null || rawPassword.length() < 8) {
                throw new BadRequestException("Пароль должен быть не короче 8 символов");
            }
            User user = User.builder()
                    .phone(normalizedPhone)
                    .passwordHash(passwordEncoder.encode(rawPassword))
                    .role("CLIENT")
                    .lastLoginAt(LocalDateTime.now())
                    .lastLoginIp(ip)
                    .build();
            return userRepository.save(user);
        }

        User user = existing.get();
        if (!user.isActive()) {
            throw new BadRequestException("Аккаунт заблокирован");
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(LocalDateTime.now())) {
            throw new BadRequestException("Слишком много попыток входа. Попробуйте позже");
        }

        if (user.getPasswordHash() == null) {
            if (rawPassword == null || rawPassword.length() < 8) {
                throw new BadRequestException("Пароль должен быть не короче 8 символов");
            }
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
            markSuccessfulLogin(user, ip);
            return userRepository.save(user);
        }

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            int failedCount = user.getFailedLoginCount() == null ? 0 : user.getFailedLoginCount();
            user.setFailedLoginCount(failedCount + 1);
            if (user.getFailedLoginCount() >= 5) {
                user.setLockedUntil(LocalDateTime.now().plusMinutes(15));
            }
            userRepository.save(user);
            throw new BadRequestException("Неверный пароль");
        }

        markSuccessfulLogin(user, ip);
        return userRepository.save(user);
    }

    @Transactional
    public User findOrCreate(String phone) {
        String normalizedPhone = normalizeLoginPhone(phone);
        return findExistingUserByPhone(phone)
                .orElseGet(() -> userRepository.save(User.builder().phone(normalizedPhone).build()));
    }

    @Transactional(readOnly = true)
    public Optional<User> findByPhone(String phone) {
        return findExistingUserByPhone(phone);
    }

    @Transactional
    public User updateName(String phone, String name) {
        User u = findExistingUserByPhone(phone)
                .orElseThrow(() -> new NotFoundException("User not found"));
        u.setName(name);
        return userRepository.save(u);
    }

    private void markSuccessfulLogin(User user, String ip) {
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(LocalDateTime.now());
        user.setLastLoginIp(ip);
    }

    private String normalizeLoginPhone(String phone) {
        String normalized = PhoneUtils.normalize(phone);
        if (normalized == null || normalized.length() < 7 || normalized.length() > 19) {
            throw new BadRequestException("Введите корректный номер телефона");
        }
        return "+" + normalized;
    }

    private Optional<User> findExistingUserByPhone(String phone) {
        String normalizedPhone = normalizeLoginPhone(phone);
        Optional<User> normalizedUser = userRepository.findByPhoneAndDeletedAtIsNull(normalizedPhone);
        if (normalizedUser.isPresent() || normalizedPhone.equals(phone)) {
            return normalizedUser;
        }
        return userRepository.findByPhoneAndDeletedAtIsNull(phone);
    }
}
