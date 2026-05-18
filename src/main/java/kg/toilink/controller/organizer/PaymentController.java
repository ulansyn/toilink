package kg.toilink.controller.organizer;

import kg.toilink.entity.Payment;
import kg.toilink.entity.PricingPlan;
import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.PaymentRepository;
import kg.toilink.repository.UserRepository;
import kg.toilink.service.PricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

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
    private final PricingService pricingService;

    /**
     * Идемпотентное создание платежа: если для этого события и тарифа уже есть активный
     * платёж (PENDING / AWAITING_CONFIRMATION) — возвращает его, не создаёт новый.
     */
    @PostMapping
    @Transactional
    public Map<String, Object> getOrCreate(@RequestBody GetOrCreateRequest body,
                                           @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (body.eventId() == null) {
            throw new BadRequestException("Event id is required for payment");
        }

        String planCode = pricingService.normalizePublicPlanCode(body.planCode());
        if (PricingService.FREE_CODE.equals(planCode)) {
            throw new BadRequestException("Бесплатный тариф активируется без оплаты");
        }

        var event = eventRepository.findByIdAndDeletedAtIsNull(body.eventId())
                .filter(e -> e.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> NotFoundException.event(body.eventId()));

        if ("PUBLISHED".equals(event.getStatus()) && !isUpgrade(event.getPlanCode(), planCode)) {
            throw new BadRequestException("Нельзя перейти на тариф ниже или равный текущему");
        }

        // идемпотентность: вернуть существующий активный платёж для того же плана
        List<Payment> existing = paymentRepository.findActiveByUserAndEvent(user.getId(), body.eventId(), planCode);
        if (!existing.isEmpty()) return toMap(existing.get(0));

        // отменить старые PENDING/AWAITING_CONFIRMATION платежи для других планов
        paymentRepository.findAllActiveByUserAndEvent(user.getId(), body.eventId())
                .forEach(p -> p.setStatus("CANCELLED"));

        PricingPlan plan = pricingService.planByCode(planCode);
        java.math.BigDecimal paymentAmount = plan.getAmount();
        if ("PUBLISHED".equals(event.getStatus()) && isUpgrade(event.getPlanCode(), planCode)) {
            String currentCode = event.getPlanCode() != null ? event.getPlanCode() : "FREE";
            try {
                PricingPlan currentPlan = pricingService.planByCode(currentCode);
                java.math.BigDecimal delta = plan.getAmount().subtract(currentPlan.getAmount());
                if (delta.compareTo(java.math.BigDecimal.ZERO) > 0) paymentAmount = delta;
            } catch (Exception ignored) {}
        }

        Payment p = new Payment();
        p.setUser(user);
        p.setPlanId(plan.getId());
        p.setPlanCode(plan.getCode());
        p.setAmount(paymentAmount); // delta for upgrades, full price for new purchases
        p.setCurrency(plan.getCurrency());
        p.setDisplayCurrency(plan.getDisplayCurrency());
        p.setMethod("QR");
        p.setStatus("PENDING");
        p.setEvent(event);

        try {
            return toMap(paymentRepository.save(p));
        } catch (DataIntegrityViolationException ex) {
            // Concurrent duplicate — return existing active payment
            List<Payment> concurrent = paymentRepository.findActiveByUserAndEvent(user.getId(), body.eventId(), planCode);
            if (!concurrent.isEmpty()) return toMap(concurrent.get(0));
            throw ex;
        }
    }

    @PostMapping("/free-activate")
    @Transactional
    public Map<String, Object> freeActivate(@RequestBody GetOrCreateRequest body,
                                            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));

        if (body.eventId() == null) {
            throw new BadRequestException("Event id is required");
        }

        var event = eventRepository.findByIdAndDeletedAtIsNull(body.eventId())
                .filter(e -> e.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> NotFoundException.event(body.eventId()));

        if ("DRAFT".equals(event.getStatus())) {
            long existing = eventRepository.countByUserIdAndStatusAndPlanCodeAndDeletedAtIsNull(
                    user.getId(), "PUBLISHED", "FREE");
            if (existing >= 1) {
                throw new BadRequestException(
                    "У вас уже есть бесплатное опубликованное событие. " +
                    "Для нового события выберите платный тариф.");
            }
            event.setStatus("PUBLISHED");
            event.setPlanCode("FREE");
            eventRepository.save(event);
        }

        return Map.of("status", event.getStatus(), "eventId", event.getId());
    }

    @PostMapping("/{id}/submit")
    @Transactional
    public Map<String, Object> submitForReview(@PathVariable Long id,
                                               @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));
        Payment payment = paymentRepository.findById(id)
                .filter(p -> p.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> new NotFoundException("Payment not found: " + id));

        if ("CONFIRMED".equals(payment.getStatus()) || "AWAITING_CONFIRMATION".equals(payment.getStatus())) {
            return toMap(payment);
        }
        if (!"PENDING".equals(payment.getStatus())) {
            throw new BadRequestException("Payment cannot be submitted from status: " + payment.getStatus());
        }

        payment.setStatus("AWAITING_CONFIRMATION");
        payment.setRejectedReason(null);
        return toMap(paymentRepository.save(payment));
    }

    @GetMapping("/event/{eventId}/latest")
    public ResponseEntity<Map<String, Object>> latestForEvent(@PathVariable Long eventId,
                                                              @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));
        eventRepository.findByIdAndDeletedAtIsNull(eventId)
                .filter(e -> e.getUser().getId().equals(user.getId()))
                .orElseThrow(() -> NotFoundException.event(eventId));

        return paymentRepository.findFirstByUserIdAndEventIdOrderByCreatedAtDesc(user.getId(), eventId)
                .map(payment -> ResponseEntity.ok(toMap(payment)))
                .orElseGet(() -> ResponseEntity.noContent().build());
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
        m.put("currency", p.getCurrency());
        m.put("displayCurrency", p.getDisplayCurrency() != null
                ? p.getDisplayCurrency()
                : pricingService.displayCurrencyFor(p.getPlanId(), p.getCurrency()));
        m.put("planCode", p.getPlanCode());
        m.put("eventId", p.getEvent() != null ? p.getEvent().getId() : null);
        m.put("rejectedReason", p.getRejectedReason());
        m.put("createdAt", p.getCreatedAt());
        return m;
    }

    private static final List<String> PLAN_RANK = PricingService.PUBLIC_PLAN_CODES;

    private boolean isUpgrade(String current, String next) {
        int from = planRank(current);
        int to = planRank(next);
        return to > from;
    }

    private int planRank(String code) {
        int rank = PLAN_RANK.indexOf(code == null ? PricingService.FREE_CODE : code);
        return rank < 0 ? 0 : rank;
    }

    public record GetOrCreateRequest(Long eventId, String planCode) {}
}
