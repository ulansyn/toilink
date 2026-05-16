package kg.toilink.service;

import kg.toilink.repository.EventRepository;
import kg.toilink.util.SlugGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SlugService {

    private final EventRepository eventRepository;

    /**
     * Generates a unique slug from person names.
     * Falls back to random if names are empty or result conflicts after 5 attempts.
     */
    @Transactional(readOnly = true)
    public String generate(String person1, String person2) {
        if (hasValue(person1)) {
            String base = SlugGenerator.fromPersons(person1, person2);
            if (!base.isBlank()) {
                return ensureUnique(base);
            }
        }
        return ensureUnique(SlugGenerator.random());
    }

    private String ensureUnique(String base) {
        if (!eventRepository.existsBySlug(base)) return base;

        // Try base-2, base-3 ...
        for (int i = 2; i <= 10; i++) {
            String candidate = base + "-" + i;
            if (!eventRepository.existsBySlug(candidate)) return candidate;
        }

        // Ultimate fallback: base + random suffix
        return base + "-" + SlugGenerator.random();
    }

    private boolean hasValue(String s) {
        return s != null && !s.isBlank();
    }
}
