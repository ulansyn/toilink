package kg.toilink.entity;

import jakarta.persistence.*;
import kg.toilink.util.PhoneUtils;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "guests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Guest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(length = 100)
    private String name;

    @Column(length = 20)
    private String phone;

    @Column(name = "phone_normalized", length = 30)
    private String phoneNormalized;

    @Column(nullable = false, length = 20)
    private String source;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false, length = 20)
    private String side;

    @Column(name = "related_to_id")
    private Long relatedToId;

    @Column(length = 30)
    private String relationType;

    @Column(unique = true)
    private UUID token;

    @Column(name = "table_id")
    private Long tableId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        if (source == null) source = "PERSONAL_LINK";
        if (side == null) side = "SHARED";
        if (token == null) token = UUID.randomUUID();
        recalcPhoneNormalized();
    }

    @PreUpdate
    void preUpdate() {
        recalcPhoneNormalized();
    }

    private void recalcPhoneNormalized() {
        String normalized = PhoneUtils.normalize(phone);
        phoneNormalized = (normalized == null || normalized.isEmpty()) ? null : normalized;
    }
}
