package kg.toilink.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id")
    private Event event;

    @Column(name = "plan_id")
    private Long planId;

    @Column(name = "plan_code", length = 50)
    private String planCode;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 10)
    private String currency;

    @Column(name = "display_currency", length = 20)
    private String displayCurrency;

    @Column(length = 30)
    private String method;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "external_ref", length = 200)
    private String externalRef;

    @Column(name = "receipt_url", length = 500)
    private String receiptUrl;

    @Column(name = "promo_code_id")
    private Long promoCodeId;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "rejected_reason", columnDefinition = "text")
    private String rejectedReason;

    @Column(name = "refunded_amount", precision = 12, scale = 2)
    private BigDecimal refundedAmount;

    @Column(name = "refunded_at")
    private LocalDateTime refundedAt;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "PENDING";
        if (currency == null) currency = "KGS";
        if (displayCurrency == null) displayCurrency = "KGS".equalsIgnoreCase(currency) ? "сом" : currency;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
