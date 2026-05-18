package kg.toilink.repository;

import kg.toilink.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByPhone(String phone);

    Optional<User> findByPhoneAndDeletedAtIsNull(String phone);

    @Query("SELECT u FROM User u WHERE u.deletedAt IS NULL ORDER BY u.createdAt DESC")
    Page<User> findAllActive(Pageable pageable);

    @Query("""
            SELECT u FROM User u
            WHERE (:includeDeleted = true OR u.deletedAt IS NULL)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(u.phone) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(u.name, '')) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:status IS NULL OR :status = ''
                   OR (:status = 'ACTIVE' AND u.isActive = true AND u.deletedAt IS NULL)
                   OR (:status = 'BLOCKED' AND u.isActive = false AND u.deletedAt IS NULL)
                   OR (:status = 'DELETED' AND u.deletedAt IS NOT NULL))
            ORDER BY u.createdAt DESC
            """)
    Page<User> searchAdmin(@Param("search") String search,
                           @Param("status") String status,
                           @Param("includeDeleted") boolean includeDeleted,
                           Pageable pageable);

    long countByCreatedAtAfter(LocalDateTime after);

    long countByDeletedAtIsNull();

    long countByCreatedAtAfterAndDeletedAtIsNull(LocalDateTime after);

    long countByIsActiveFalseAndDeletedAtIsNull();

    long countByRoleAndDeletedAtIsNull(String role);
}
