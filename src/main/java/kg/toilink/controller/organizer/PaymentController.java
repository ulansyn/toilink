package kg.toilink.controller.organizer;

import kg.toilink.entity.Event;
import kg.toilink.entity.Payment;
import kg.toilink.entity.User;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.PaymentRepository;
import kg.toilink.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/organizer/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentRepository paymentRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> initPayment(@RequestBody InitPaymentRequest body,
                                           @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByPhone(principal.getUsername())
                .orElseThrow(() -> new NotFoundException("User not found"));

        Payment p = new Payment();
        p.setUser(user);
        p.setAmount(new BigDecimal("990"));
        p.setCurrency("KGS");
        p.setMethod(body.method() != null && !body.method().isBlank() ? body.method() : "QR");
        p.setStatus("AWAITING_CONFIRMATION");
        if (body.orderRef() != null && !body.orderRef().isBlank()) {
            p.setExternalRef(body.orderRef().trim());
        }

        if (body.eventId() != null) {
            eventRepository.findByIdAndDeletedAtIsNull(body.eventId())
                    .filter(e -> e.getUser().getId().equals(user.getId()))
                    .ifPresent(p::setEvent);
        }

        Payment saved = paymentRepository.save(p);
        return Map.of(
            "paymentId", saved.getId(),
            "orderRef", saved.getExternalRef() != null ? saved.getExternalRef() : ""
        );
    }

    public record InitPaymentRequest(Long eventId, String method, String orderRef) {}
}
