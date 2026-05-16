package kg.toilink.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private Template template;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 100)
    private String person1;

    @Column(length = 100)
    private String person2;

    private LocalDateTime eventDate;

    @Column(length = 500)
    private String location;

    @Column(length = 500)
    private String coverImageUrl;

    @Column(nullable = false, unique = true, length = 50)
    private String slug;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Guest> guests = new ArrayList<>();

    @Column(nullable = false, unique = true)
    private UUID previewToken;

    @Column(nullable = false, length = 20)
    private String status;

    private LocalDateTime rsvpDeadline;

    @Column(nullable = false, length = 10)
    private String language;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String blocksConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "guest_groups", nullable = false, columnDefinition = "jsonb")
    private String guestGroups;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    private LocalDateTime deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "DRAFT";
        if (language == null) language = "ru";
        if (previewToken == null) previewToken = UUID.randomUUID();
        if (guestGroups == null) guestGroups = "[]";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
