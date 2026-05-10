package kg.toilink.service;

import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService implements UserDetailsService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String phone) throws UsernameNotFoundException {
        User user = userRepository.findByPhone(phone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + phone));
        return org.springframework.security.core.userdetails.User
                .withUsername(user.getPhone())
                .password(user.getPasswordHash() != null ? user.getPasswordHash() : "")
                .authorities("ROLE_USER")
                .build();
    }

    /**
     * Login or register in one step:
     * - New phone → create user with password, return user
     * - Existing user, no password yet → set password, return user
     * - Existing user, wrong password → throw BadRequestException
     * - Existing user, correct password → return user
     */
    @Transactional
    public User loginOrRegister(String phone, String rawPassword) {
        Optional<User> existing = userRepository.findByPhone(phone);

        if (existing.isEmpty()) {
            User user = User.builder()
                    .phone(phone)
                    .passwordHash(passwordEncoder.encode(rawPassword))
                    .build();
            return userRepository.save(user);
        }

        User user = existing.get();

        if (user.getPasswordHash() == null) {
            user.setPasswordHash(passwordEncoder.encode(rawPassword));
            return userRepository.save(user);
        }

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new BadRequestException("Неверный пароль");
        }

        return user;
    }

    @Transactional
    public User findOrCreate(String phone) {
        return userRepository.findByPhone(phone)
                .orElseGet(() -> userRepository.save(User.builder().phone(phone).build()));
    }

    @Transactional(readOnly = true)
    public Optional<User> findByPhone(String phone) {
        return userRepository.findByPhone(phone);
    }
}
