package kg.toilink.repository;

import kg.toilink.entity.RsvpResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RsvpResponseRepository extends JpaRepository<RsvpResponse, Long> {

    interface EventStatusCountView {
        Long getEventId();
        String getStatus();
        long getTotal();
    }

    Optional<RsvpResponse> findByGuestIdAndEventId(Long guestId, Long eventId);

    List<RsvpResponse> findAllByEventId(Long eventId);

    @Query("""
            select r.event.id as eventId, r.status as status, count(r) as total
            from RsvpResponse r
            where r.event.id = :eventId
              and r.guest.deletedAt is null
            group by r.event.id, r.status
            """)
    List<EventStatusCountView> countStatusesByEventId(@Param("eventId") Long eventId);

    @Query("""
            select r.event.id as eventId, r.status as status, count(r) as total
            from RsvpResponse r
            where r.event.id in :eventIds
              and r.guest.deletedAt is null
            group by r.event.id, r.status
            """)
    List<EventStatusCountView> countStatusesByEventIds(@Param("eventIds") Collection<Long> eventIds);

    long countByRespondedAtAfter(LocalDateTime after);
}
