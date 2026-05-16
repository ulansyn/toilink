package kg.toilink.repository;

import kg.toilink.entity.LandingSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LandingSettingsRepository extends JpaRepository<LandingSettings, Long> {
    Optional<LandingSettings> findBySettingsKey(String settingsKey);
}
