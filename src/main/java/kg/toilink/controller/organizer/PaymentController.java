package kg.toilink.controller.organizer;

import kg.toilink.entity.Payment;
import kg.toilink.entity.User;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.PaymentRepository;
import kg.toilink.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/organizer/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentRepository paymentRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    /**
     * Идемпотентное создание платежа: если для этого события уже есть активный
     * платёж (PENDING / AWAITING_CONFIRMATION) — возвращает его, не создаёт новый.
     */
    @PostMapping
    @Transactional
    public Map<String, Object> getOrCreate(@RequestBody GetOrCreateRequest body,
                                           @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (body.eventId() != null) {
            List<Payment> existing = paymentRepository.findActiveByUserAndEvent(user.getId(), body.eventId());
            if (!existing.isEmpty()) return toMap(existing.get(0));
        }

        Payment p = new Payment();
        p.setUser(user);
        p.setAmount(new BigDecimal("990"));
        p.setCurrency("KGS");
        p.setMethod("QR");
        p.setStatus("AWAITING_CONFIRMATION");

        if (body.eventId() != null) {
            eventRepository.findByIdAndDeletedAtIsNull(body.eventId())
                    .filter(e -> e.getUser().getId().equals(user.getId()))
                    .ifPresent(p::setEvent);
        }

        return toMap(paymentRepository.save(p));
    }

    @GetMapping
    public List<Map<String, Object>> myPayments(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));
        return paymentRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toMap).toList();
    }

    private Map<String, Object> toMap(Payment p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("status", p.getStatus());
        m.put("amount", p.getAmount());
        m.put("eventId", p.getEvent() != null ? p.getEvent().getId() : null);
        m.put("rejectedReason", p.getRejectedReason());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    public record GetOrCreateRequest(Long eventId) {}
}
