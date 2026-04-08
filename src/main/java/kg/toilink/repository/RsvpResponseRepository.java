package kg.toilink.repository;

import kg.toilink.entity.RsvpResponse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RsvpResponseRepository extends JpaRepository<RsvpResponse, Long> {

    Optional<RsvpResponse> findByGuestIdAndEventId(Long guestId, Long eventId);

    List<RsvpResponse> findAllByEventId(Long eventId);
}
