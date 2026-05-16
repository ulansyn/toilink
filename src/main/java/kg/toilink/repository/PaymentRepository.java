package kg.toilink.repository;

import kg.toilink.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findAllByOrderByCreatedAtDesc();

    List<Payment> findByStatusOrderByCreatedAtDesc(String status);

    List<Payment> findByUserIdOrderByCreatedAtDesc(Long userId);

    @EntityGraph(attributePaths = {"user", "event"})
    @Query("""
            SELECT p FROM Payment p
            LEFT JOIN p.user u
            LEFT JOIN p.event e
            WHERE (:status IS NULL OR :status = '' OR p.status = :status)
              AND (:search IS NULL OR :search = ''
                   OR LOWER(COALESCE(u.phone, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(u.name, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(e.title, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                   OR LOWER(COALESCE(p.externalRef, '')) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY p.createdAt DESC
            """)
    Page<Payment> searchAdmin(@Param("status") String status,
                              @Param("search") String search,
                              Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'CONFIRMED'")
    BigDecimal sumConfirmed();

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.status = 'CONFIRMED' AND p.confirmedAt >= :after")
    BigDecimal sumConfirmedAfter(@Param("after") LocalDateTime after);

    long countByStatus(String status);

    long countByStatusAndCreatedAtAfter(String status, LocalDateTime after);

    long countByStatusIn(List<String> statuses);

    @Query(value = """
            SELECT DATE(confirmed_at) AS day,
                   COALESCE(SUM(amount), 0) AS revenue,
                   COUNT(*) AS cnt
            FROM payments
            WHERE status = 'CONFIRMED'
              AND confirmed_at >= :since
            GROUP BY DATE(confirmed_at)
            ORDER BY DATE(confirmed_at)
            """, nativeQuery = true)
    List<Object[]> dailyRevenue(@Param("since") LocalDateTime since);

    @Query(value = """
            SELECT COALESCE(method, 'other') AS method, COUNT(*) AS cnt
            FROM payments
            WHERE status = 'CONFIRMED'
            GROUP BY method
            ORDER BY cnt DESC
            """, nativeQuery = true)
    List<Object[]> methodBreakdown();
}
