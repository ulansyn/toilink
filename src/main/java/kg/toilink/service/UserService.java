package kg.toilink.service;

import kg.toilink.entity.User;
import kg.toilink.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public User findOrCreate(String phone) {
        return userRepository.findByPhone(phone)
                .orElseGet(() -> userRepository.save(
                        User.builder().phone(phone).build()
                ));
    }
}
