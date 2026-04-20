package kg.toilink.repository;

import kg.toilink.entity.Guest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GuestRepository extends JpaRepository<Guest, Long> {

    interface EventGuestCountView {
        Long getEventId();
        long getTotal();
    }

    List<Guest> findAllByEventId(Long eventId);

    Optional<Guest> findByToken(UUID token);

    Optional<Guest> findByEventIdAndNameAndSource(Long eventId, String name, String source);
    long countByEventId(Long eventId);

    @Query("""
            select g.event.id as eventId, count(g) as total
            from Guest g
            where g.event.id in :eventIds
            group by g.event.id
            """)
    List<EventGuestCountView> countByEventIds(@Param("eventIds") Collection<Long> eventIds);
}
