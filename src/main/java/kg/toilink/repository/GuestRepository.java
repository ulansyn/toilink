package kg.toilink.repository;

import kg.toilink.entity.Guest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Query("SELECT g FROM Guest g WHERE g.event.id = :eventId AND g.deletedAt IS NULL ORDER BY g.createdAt DESC")
    List<Guest> findAllByEventId(@Param("eventId") Long eventId);

    Optional<Guest> findByTokenAndDeletedAtIsNull(UUID token);

    Optional<Guest> findByEventIdAndNameAndSource(Long eventId, String name, String source);
    @Query("SELECT COUNT(g) FROM Guest g WHERE g.event.id = :eventId AND g.deletedAt IS NULL")
    long countByEventId(@Param("eventId") Long eventId);

    long countByDeletedAtIsNull();

    @Query("""
            select g.event.id as eventId, count(g) as total
            from Guest g
            where g.event.id in :eventIds
              and g.deletedAt is null
            group by g.event.id
            """)
    List<EventGuestCountView> countByEventIds(@Param("eventIds") Collection<Long> eventIds);

    interface TableGuestCountView {
        Long getTableId();
        long getCnt();
    }

    @Query("SELECT g.tableId as tableId, COUNT(g) as cnt FROM Guest g WHERE g.tableId IN :tableIds AND g.deletedAt IS NULL GROUP BY g.tableId")
    List<TableGuestCountView> countByTableIds(@Param("tableIds") Collection<Long> tableIds);

    @Modifying
    @Query("UPDATE Guest g SET g.tableId = NULL WHERE g.tableId = :tableId")
    void clearTableId(@Param("tableId") Long tableId);

    @Query("SELECT g FROM Guest g WHERE g.event.id = :eventId AND g.id IN :ids AND g.deletedAt IS NULL")
    List<Guest> findAllByEventIdAndIdIn(@Param("eventId") Long eventId, @Param("ids") Collection<Long> ids);
}
