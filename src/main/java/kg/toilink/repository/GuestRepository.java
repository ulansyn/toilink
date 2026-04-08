package kg.toilink.repository;

import kg.toilink.entity.Guest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GuestRepository extends JpaRepository<Guest, Long> {

    List<Guest> findAllByEventId(Long eventId);

    Optional<Guest> findByToken(UUID token);
}
