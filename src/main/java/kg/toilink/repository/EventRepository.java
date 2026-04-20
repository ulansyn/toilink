package kg.toilink.repository;

import kg.toilink.entity.Event;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    Optional<Event> findBySlug(String slug);

    @EntityGraph(attributePaths = {"template"})
    Optional<Event> findWithTemplateBySlug(String slug);

    List<Event> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    boolean existsBySlug(String slug);
}
