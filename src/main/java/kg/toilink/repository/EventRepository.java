package kg.toilink.repository;

import jakarta.persistence.LockModeType;
import kg.toilink.entity.Event;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface EventRepository extends JpaRepository<Event, Long> {

    @Query("SELECT e FROM Event e WHERE e.slug = :slug AND e.deletedAt IS NULL")
    Optional<Event> findBySlug(@Param("slug") String slug);

    @EntityGraph(attributePaths = {"template"})
    @Query("SELECT e FROM Event e WHERE e.slug = :slug AND e.deletedAt IS NULL")
    Optional<Event> findWithTemplateBySlug(@Param("slug") String slug);

    @Query("SELECT e FROM Event e WHERE e.id = :id AND e.deletedAt IS NULL")
    Optional<Event> findByIdAndDeletedAtIsNull(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM Event e WHERE e.id = :id AND e.deletedAt IS NULL")
    Optional<Event> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT e FROM Event e WHERE e.user.id = :userId AND e.deletedAt IS NULL ORDER BY e.createdAt DESC")
    List<Event> findAllByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    @EntityGraph(attributePaths = {"user", "template"})
    @Query("SELECT e FROM Event e WHERE e.user.id = :userId ORDER BY e.createdAt DESC")
    Page<Event> findAdminByUserId(@Param("userId") Long userId, Pageable pageable);

    @Query("SELECT e FROM Event e LEFT JOIN FETCH e.user ORDER BY e.createdAt DESC")
    List<Event> findAllWithUser();

    @Query("SELECT e FROM Event e LEFT JOIN FETCH e.user ORDER BY e.createdAt DESC")
    Page<Event> findAllWithUser(Pageable pageable);

    @EntityGraph(attributePaths = {"user", "template"})
    @Query("""
            SELECT e FROM Event e
            LEFT JOIN e.user u
            LEFT JOIN e.template t
            WHERE (:includeDeleted = true OR e.deletedAt IS NULL)
              AND (:status IS NULL OR :status = '' OR e.status = :status)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(e.title) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(e.slug) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.person1, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.person2, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(u.phone, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(t.name, '')) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY e.createdAt DESC
            """)
    Page<Event> searchAdmin(@Param("search") String search,
                            @Param("status") String status,
                            @Param("includeDeleted") boolean includeDeleted,
                            Pageable pageable);

    long countByStatus(String status);

    long countByCreatedAtAfter(LocalDateTime after);

    long countByDeletedAtIsNull();

    long countByCreatedAtAfterAndDeletedAtIsNull(LocalDateTime after);

    long countByStatusAndDeletedAtIsNull(String status);

    long countByUserIdAndStatusAndPlanCodeAndDeletedAtIsNull(Long userId, String status, String planCode);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);
}
