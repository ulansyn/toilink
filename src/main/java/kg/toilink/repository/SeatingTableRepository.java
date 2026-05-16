package kg.toilink.repository;

import kg.toilink.entity.SeatingTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeatingTableRepository extends JpaRepository<SeatingTable, Long> {
    List<SeatingTable> findAllByEventIdOrderByCreatedAtAsc(Long eventId);
}
