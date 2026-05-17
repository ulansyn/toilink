package kg.toilink.controller.admin;

import jakarta.servlet.http.HttpServletRequest;
import kg.toilink.entity.AdminAuditLog;
import kg.toilink.entity.Event;
import kg.toilink.entity.Payment;
import kg.toilink.entity.PricingPlan;
import kg.toilink.entity.Template;
import kg.toilink.entity.User;
import kg.toilink.exception.BadRequestException;
import kg.toilink.exception.NotFoundException;
import kg.toilink.repository.AdminAuditLogRepository;
import kg.toilink.repository.EventRepository;
import kg.toilink.repository.GuestRepository;
import kg.toilink.repository.PaymentRepository;
import kg.toilink.repository.RsvpResponseRepository;
import kg.toilink.repository.TemplateRepository;
import kg.toilink.repository.UserRepository;
import kg.toilink.service.LandingSettingsService;
import kg.toilink.service.PricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import tools.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final int MAX_PAGE_SIZE = 100;
    private static final Pattern SLUG_PATTERN = Pattern.compile("[a-z0-9а-яёңүө-]+");

    private final UserRepository userRepository;
    private final EventRepository eventRepository;
    private final GuestRepository guestRepository;
    private final RsvpResponseRepository rsvpResponseRepository;
    private final TemplateRepository templateRepository;
    private final PaymentRepository paymentRepository;
    private final AdminAuditLogRepository auditLogRepository;
    private final LandingSettingsService landingSettingsService;
    private final PricingService pricingService;
    private final ObjectMapper objectMapper;

    @GetMapping("/dashboard")
    public AdminDashboardResponse dashboard() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime weekStart = todayStart.minusDays(7);

        return new AdminDashboardResponse(
                userRepository.countByDeletedAtIsNull(),
                userRepository.countByCreatedAtAfterAndDeletedAtIsNull(todayStart),
                userRepository.countByIsActiveFalseAndDeletedAtIsNull(),
                eventRepository.countByDeletedAtIsNull(),
                eventRepository.countByCreatedAtAfterAndDeletedAtIsNull(todayStart),
                eventRepository.countByStatusAndDeletedAtIsNull("PUBLISHED"),
                eventRepository.countByStatusAndDeletedAtIsNull("CLOSED"),
                guestRepository.countByDeletedAtIsNull(),
                rsvpResponseRepository.countByRespondedAtAfter(todayStart),
                rsvpResponseRepository.countByRespondedAtAfter(weekStart),
                templateRepository.countByIsActiveTrue(),
                paymentRepository.countByStatus("AWAITING_CONFIRMATION"),
                paymentRepository.countByStatus("CONFIRMED"),
                paymentRepository.countByStatusAndCreatedAtAfter("CONFIRMED", todayStart),
                paymentRepository.sumConfirmed(),
                paymentRepository.sumConfirmedAfter(todayStart)
        );
    }

    @GetMapping("/dashboard/chart")
    public List<Map<String, Object>> revenueChart(@RequestParam(defaultValue = "30") int days) {
        LocalDateTime since = LocalDate.now().minusDays(days - 1).atStartOfDay();
        List<Object[]> rows = paymentRepository.dailyRevenue(since);
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Object[] row : rows) {
            result.add(Map.of(
                "date", row[0].toString(),
                "revenue", ((Number) row[1]).doubleValue(),
                "count", ((Number) row[2]).longValue()
            ));
        }
        return result;
    }

    @GetMapping("/dashboard/payment-methods")
    public List<Map<String, Object>> paymentMethods() {
        List<Object[]> rows = paymentRepository.methodBreakdown();
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Object[] row : rows) {
            result.add(Map.of(
                "method", row[0].toString(),
                "count", ((Number) row[1]).longValue()
            ));
        }
        return result;
    }

    @GetMapping("/users")
    public Page<AdminUserResponse> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return userRepository.searchAdmin(blankToNull(search), blankToNull(status), includeDeleted, pageRequest(page, size))
                .map(AdminUserResponse::from);
    }

    @GetMapping("/users/{id}")
    public AdminUserResponse getUser(@PathVariable Long id) {
        return AdminUserResponse.from(userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id)));
    }

    @PostMapping("/users/{id}/block")
    @Transactional
    public AdminUserResponse blockUser(@PathVariable Long id,
                                       @RequestBody(required = false) AdminReasonRequest body,
                                       @AuthenticationPrincipal UserDetails admin,
                                       HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        protectLastSuperAdmin(user, admin);
        user.setActive(false);
        userRepository.save(user);
        audit(admin, request, "USER_BLOCK", "USER", id, reason(body));
        return AdminUserResponse.from(user);
    }

    @PostMapping("/users/{id}/unblock")
    @Transactional
    public AdminUserResponse unblockUser(@PathVariable Long id,
                                         @RequestBody(required = false) AdminReasonRequest body,
                                         @AuthenticationPrincipal UserDetails admin,
                                         HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        user.setActive(true);
        user.setLockedUntil(null);
        user.setFailedLoginCount(0);
        userRepository.save(user);
        audit(admin, request, "USER_UNBLOCK", "USER", id, reason(body));
        return AdminUserResponse.from(user);
    }

    @PutMapping("/users/{id}/role")
    @Transactional
    public AdminUserResponse changeUserRole(@PathVariable Long id,
                                            @RequestBody Map<String, String> body,
                                            @AuthenticationPrincipal UserDetails admin,
                                            HttpServletRequest request) {
        String newRole = body.get("role");
        if (newRole == null || !List.of("CLIENT", "MANAGER", "SUPERADMIN").contains(newRole)) {
            throw new BadRequestException("Недопустимая роль. Допустимые значения: CLIENT, MANAGER, SUPERADMIN");
        }
        User target = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        if ("SUPERADMIN".equals(target.getRole()) && !"SUPERADMIN".equals(newRole)
                && userRepository.countByRoleAndDeletedAtIsNull("SUPERADMIN") <= 1) {
            throw new BadRequestException("Нельзя снять роль у последнего SUPERADMIN");
        }
        String oldRole = target.getRole();
        target.setRole(newRole);
        userRepository.save(target);
        audit(admin, request, "USER_ROLE_CHANGE", "USER", id, oldRole + " → " + newRole);
        return AdminUserResponse.from(target);
    }

    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<Void> deleteUser(@PathVariable Long id,
                                           @RequestBody(required = false) AdminReasonRequest body,
                                           @AuthenticationPrincipal UserDetails admin,
                                           HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        protectLastSuperAdmin(user, admin);
        user.setDeletedAt(LocalDateTime.now());
        user.setActive(false);
        userRepository.save(user);
        audit(admin, request, "USER_DELETE", "USER", id, reason(body));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/{id}/events")
    public Page<AdminEventResponse> getUserEvents(@PathVariable Long id,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "20") int size) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found: " + id));
        return eventRepository.searchAdmin(user.getPhone(), null, true, pageRequest(page, size))
                .map(AdminEventResponse::from);
    }

    @GetMapping("/events")
    public Page<AdminEventResponse> listEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return eventRepository.searchAdmin(blankToNull(search), blankToNull(status), includeDeleted, pageRequest(page, size))
                .map(AdminEventResponse::from);
    }

    @GetMapping("/events/{id}")
    public AdminEventResponse getEvent(@PathVariable Long id) {
        return AdminEventResponse.from(eventRepository.findById(id)
                .orElseThrow(() -> NotFoundException.event(id)));
    }

    @PatchMapping("/events/{id}")
    @Transactional
    public AdminEventResponse updateEvent(@PathVariable Long id,
                                          @RequestBody AdminEventUpdateRequest body,
                                          @AuthenticationPrincipal UserDetails admin,
                                          HttpServletRequest request) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> NotFoundException.event(id));
        if (body.status() != null) {
            validateEventStatus(body.status());
            event.setStatus(body.status());
        }
        if (body.title() != null) event.setTitle(validateLength(body.title(), "Название события", 200, true));
        if (body.slug() != null && !body.slug().isBlank()) {
            String slug = validateSlug(body.slug());
            if (!slug.equals(event.getSlug()) && eventRepository.existsBySlugAndIdNot(slug, id)) {
                throw new BadRequestException("Slug уже занят: " + slug);
            }
            event.setSlug(slug);
        }
        if (body.location() != null) event.setLocation(validateLength(body.location(), "Локация", 500, false));
        eventRepository.save(event);
        audit(admin, request, "EVENT_UPDATE", "EVENT", id, body.reason());
        return AdminEventResponse.from(event);
    }

    @DeleteMapping("/events/{id}")
    @Transactional
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id,
                                           @RequestBody(required = false) AdminReasonRequest body,
                                           @AuthenticationPrincipal UserDetails admin,
                                           HttpServletRequest request) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> NotFoundException.event(id));
        event.setDeletedAt(LocalDateTime.now());
        eventRepository.save(event);
        audit(admin, request, "EVENT_DELETE", "EVENT", id, reason(body));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/events/{id}/restore")
    @Transactional
    public AdminEventResponse restoreEvent(@PathVariable Long id,
                                           @RequestBody(required = false) AdminReasonRequest body,
                                           @AuthenticationPrincipal UserDetails admin,
                                           HttpServletRequest request) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> NotFoundException.event(id));
        event.setDeletedAt(null);
        eventRepository.save(event);
        audit(admin, request, "EVENT_RESTORE", "EVENT", id, reason(body));
        return AdminEventResponse.from(event);
    }

    @GetMapping("/templates")
    public Page<AdminTemplateResponse> listTemplates(@RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "50") int size) {
        return templateRepository.findAllByOrderBySortOrderAsc(pageRequest(page, size))
                .map(AdminTemplateResponse::from);
    }

    @PostMapping("/templates")
    @Transactional
    public AdminTemplateResponse createTemplate(@RequestBody AdminTemplateCreateRequest body,
                                                @AuthenticationPrincipal UserDetails admin,
                                                HttpServletRequest request) {
        if (body.name() == null || body.name().isBlank()) {
            throw new BadRequestException("Название шаблона обязательно");
        }
        String templatePath = body.templatePath() == null || body.templatePath().isBlank()
                ? slugify(body.name())
                : body.templatePath().trim();
        Template template = Template.builder()
                .name(validateLength(body.name(), "Название шаблона", 100, true))
                .description(body.description() != null ? body.description().trim() : "")
                .thumbnailUrl(body.thumbnailUrl() != null ? validateLength(body.thumbnailUrl(), "Обложка", 500, false) : null)
                .category(body.category() != null && !body.category().isBlank() ? validateLength(body.category(), "Категория", 50, true) : "WEDDING")
                .templatePath(validateLength(templatePath, "Путь шаблона", 100, true))
                .blocksSchema(body.blocksSchema() != null && !body.blocksSchema().isBlank()
                        ? validateJson(body.blocksSchema(), "Схема блоков")
                        : defaultTemplateSchema())
                .sortOrder(body.sortOrder() != null ? body.sortOrder() : 100)
                .isActive(Boolean.TRUE.equals(body.active()))
                .build();

        Template saved = templateRepository.save(template);
        if (!Boolean.TRUE.equals(body.active())) {
            saved.setActive(false);
            saved = templateRepository.save(saved);
        }
        audit(admin, request, "TEMPLATE_CREATE", "TEMPLATE", saved.getId(), body.reason());
        return AdminTemplateResponse.from(saved);
    }

    @PatchMapping("/templates/{id}")
    @Transactional
    public AdminTemplateResponse updateTemplate(@PathVariable Long id,
                                                @RequestBody AdminTemplateUpdateRequest body,
                                                @AuthenticationPrincipal UserDetails admin,
                                                HttpServletRequest request) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> NotFoundException.template(id));
        if (body.name() != null) template.setName(validateLength(body.name(), "Название шаблона", 100, true));
        if (body.description() != null) template.setDescription(body.description().trim());
        if (body.thumbnailUrl() != null) template.setThumbnailUrl(validateLength(body.thumbnailUrl(), "Обложка", 500, false));
        if (body.category() != null) template.setCategory(validateLength(body.category(), "Категория", 50, true));
        if (body.templatePath() != null) template.setTemplatePath(validateLength(body.templatePath(), "Путь шаблона", 100, true));
        if (body.blocksSchema() != null) template.setBlocksSchema(validateJson(body.blocksSchema(), "Схема блоков"));
        if (body.sortOrder() != null) template.setSortOrder(body.sortOrder());
        if (body.active() != null) template.setActive(body.active());
        templateRepository.save(template);
        audit(admin, request, "TEMPLATE_UPDATE", "TEMPLATE", id, body.reason());
        return AdminTemplateResponse.from(template);
    }

    @DeleteMapping("/templates/{id}")
    @Transactional
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id,
                                               @AuthenticationPrincipal UserDetails admin,
                                               HttpServletRequest request) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> NotFoundException.template(id));
        templateRepository.delete(template);
        audit(admin, request, "TEMPLATE_DELETE", "TEMPLATE", id, null);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/payments")
    public Page<AdminPaymentResponse> listPayments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return paymentRepository.searchAdmin(blankToNull(status), blankToNull(search), pageRequest(page, size))
                .map(AdminPaymentResponse::from);
    }

    @GetMapping("/payments/{id}")
    public AdminPaymentResponse getPayment(@PathVariable Long id) {
        return AdminPaymentResponse.from(paymentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Payment not found: " + id)));
    }

    @PostMapping("/payments/{id}/confirm")
    @Transactional
    public AdminPaymentResponse confirmPayment(@PathVariable Long id,
                                               @RequestBody(required = false) AdminPaymentActionRequest body,
                                               @AuthenticationPrincipal UserDetails admin,
                                               HttpServletRequest request) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Payment not found: " + id));
        if ("REJECTED".equals(payment.getStatus())) {
            throw new BadRequestException("Отклонённую оплату нельзя подтвердить. Попросите клиента создать новую заявку.");
        }
        payment.setStatus("CONFIRMED");
        payment.setConfirmedAt(LocalDateTime.now());
        payment.setConfirmedBy(currentAdminId(admin));
        payment.setRejectedReason(null);
        String externalRef = externalRef(body);
        if (externalRef != null) payment.setExternalRef(externalRef);
        if (body != null && body.notes() != null) payment.setNotes(body.notes());
        paymentRepository.save(payment);

        Event linkedEvent = payment.getEvent();
        if (linkedEvent != null && "DRAFT".equals(linkedEvent.getStatus())) {
            linkedEvent.setStatus("PUBLISHED");
            linkedEvent.setPlanCode(payment.getPlanCode());
            eventRepository.save(linkedEvent);
        }

        audit(admin, request, "PAYMENT_CONFIRM", "PAYMENT", id, body != null ? body.reason() : null);
        return AdminPaymentResponse.from(payment);
    }

    @PostMapping("/payments/{id}/reject")
    @Transactional
    public AdminPaymentResponse rejectPayment(@PathVariable Long id,
                                              @RequestBody(required = false) AdminPaymentActionRequest body,
                                              @AuthenticationPrincipal UserDetails admin,
                                              HttpServletRequest request) {
        Payment payment = paymentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Payment not found: " + id));
        if ("CONFIRMED".equals(payment.getStatus())) {
            throw new BadRequestException("Подтверждённую оплату нельзя отклонить");
        }
        String reason = body != null ? body.reason() : null;
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Причина отклонения обязательна");
        }
        payment.setStatus("REJECTED");
        payment.setRejectedReason(reason.trim());
        paymentRepository.save(payment);
        audit(admin, request, "PAYMENT_REJECT", "PAYMENT", id, reason);
        return AdminPaymentResponse.from(payment);
    }

    @GetMapping("/audit")
    public Page<AdminAuditResponse> audit(@RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageRequest(page, size))
                .map(AdminAuditResponse::from);
    }

    @GetMapping("/landing")
    public AdminLandingResponse getLanding() {
        return new AdminLandingResponse(landingSettingsService.getMainContentJson());
    }

    @PutMapping("/landing")
    @Transactional
    public AdminLandingResponse updateLanding(@RequestBody AdminLandingUpdateRequest body,
                                              @AuthenticationPrincipal UserDetails admin,
                                              HttpServletRequest request) {
        String contentJson = landingSettingsService.updateMainContentJson(body.contentJson());
        audit(admin, request, "LANDING_UPDATE", "LANDING", null, body.reason());
        return new AdminLandingResponse(contentJson);
    }

    @GetMapping("/pricing/activation")
    public AdminPricingPlanResponse getActivationPricing() {
        return AdminPricingPlanResponse.from(pricingService.activationPlan());
    }

    @PutMapping("/pricing/activation")
    @Transactional
    public AdminPricingPlanResponse updateActivationPricing(@RequestBody AdminPricingUpdateRequest body,
                                                            @AuthenticationPrincipal UserDetails admin,
                                                            HttpServletRequest request) {
        if (body == null) {
            throw new BadRequestException("Данные тарифа обязательны");
        }
        PricingPlan plan = pricingService.updateActivationPlan(
                body.amount(),
                body.currency(),
                body.displayCurrency(),
                body.name()
        );
        audit(admin, request, "PRICING_UPDATE", "PRICING_PLAN", plan.getId(), body.reason());
        return AdminPricingPlanResponse.from(plan);
    }

    @GetMapping("/pricing/plans")
    public List<AdminPricingPlanResponse> listPricingPlans() {
        return pricingService.allPlans().stream().map(AdminPricingPlanResponse::from).toList();
    }

    @PutMapping("/pricing/plans/{code}")
    @Transactional
    public AdminPricingPlanResponse updatePricingPlan(@PathVariable String code,
                                                      @RequestBody AdminPricingUpdateRequest body,
                                                      @AuthenticationPrincipal UserDetails admin,
                                                      HttpServletRequest request) {
        if (body == null) {
            throw new BadRequestException("Данные тарифа обязательны");
        }
        PricingPlan plan = pricingService.updatePlan(
                code,
                body.amount(),
                body.currency(),
                body.displayCurrency(),
                body.name()
        );
        audit(admin, request, "PRICING_UPDATE", "PRICING_PLAN", plan.getId(), body.reason());
        return AdminPricingPlanResponse.from(plan);
    }

    private PageRequest pageRequest(int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        return PageRequest.of(safePage, safeSize);
    }

    private void validateEventStatus(String status) {
        if (!status.equals("DRAFT") && !status.equals("PUBLISHED") && !status.equals("CLOSED")) {
            throw new BadRequestException("Invalid event status: " + status);
        }
    }

    private String validateSlug(String value) {
        String slug = value.trim().toLowerCase();
        if (slug.isBlank()) {
            throw new BadRequestException("Slug обязателен");
        }
        if (slug.length() > 50) {
            throw new BadRequestException("Slug не должен превышать 50 символов");
        }
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new BadRequestException("Slug может содержать только буквы, цифры и дефис");
        }
        return slug;
    }

    private String validateLength(String value, String fieldName, int max, boolean required) {
        String trimmed = value.trim();
        if (required && trimmed.isBlank()) {
            throw new BadRequestException(fieldName + " обязательно");
        }
        if (trimmed.length() > max) {
            throw new BadRequestException(fieldName + " не должен превышать " + max + " символов");
        }
        return trimmed;
    }

    private String validateJson(String value, String fieldName) {
        try {
            objectMapper.readTree(value);
            return value;
        } catch (Exception e) {
            throw new BadRequestException(fieldName + " содержит некорректный JSON");
        }
    }

    private void protectLastSuperAdmin(User target, UserDetails admin) {
        if (admin != null && target.getPhone().equals(admin.getUsername())) {
            throw new BadRequestException("Нельзя заблокировать или удалить текущий SUPERADMIN аккаунт");
        }
        if ("SUPERADMIN".equals(target.getRole()) && userRepository.countByRoleAndDeletedAtIsNull("SUPERADMIN") <= 1) {
            throw new BadRequestException("Нельзя удалить или заблокировать последнего SUPERADMIN");
        }
    }

    private void audit(UserDetails admin, HttpServletRequest request, String action, String targetType, Long targetId, String reason) {
        auditLogRepository.save(AdminAuditLog.builder()
                .adminUserId(currentAdminId(admin))
                .actionCode(action)
                .targetType(targetType)
                .targetId(targetId != null ? String.valueOf(targetId) : null)
                .reason(reason)
                .ip(clientIp(request))
                .userAgent(request.getHeader("User-Agent"))
                .build());
    }

    private Long currentAdminId(UserDetails admin) {
        if (admin == null) return null;
        return userRepository.findByPhone(admin.getUsername()).map(User::getId).orElse(null);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private String reason(AdminReasonRequest body) {
        return body != null ? body.reason() : null;
    }

    private String externalRef(AdminPaymentActionRequest body) {
        if (body == null) return null;
        String value = body.externalRef() != null ? body.externalRef() : body.external_ref();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String defaultTemplateSchema() {
        return """
                [{"type":"hero","label":"Главный экран","fields":["title","subtitle","image_url"]},{"type":"details","label":"Детали","fields":["date_text","time_text","address"]},{"type":"rsvp","label":"RSVP","fields":["enabled"]}]
                """;
    }

    private String slugify(String value) {
        String slug = value.toLowerCase()
                .replaceAll("[^a-z0-9а-яё]+", "-")
                .replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "template-" + System.currentTimeMillis() : slug;
    }

    public record AdminDashboardResponse(
            long usersTotal,
            long usersToday,
            long usersBlocked,
            long eventsTotal,
            long eventsToday,
            long eventsPublished,
            long eventsClosed,
            long guestsTotal,
            long rsvpsToday,
            long rsvpsWeek,
            long templatesActive,
            long paymentsPending,
            long paymentsConfirmedTotal,
            long paymentsConfirmedToday,
            BigDecimal revenueTotal,
            BigDecimal revenueToday
    ) {}

    public record AdminReasonRequest(String reason) {}

    public record AdminEventUpdateRequest(String title, String status, String slug, String location, String reason) {}

    public record AdminTemplateUpdateRequest(
            String name,
            String description,
            String thumbnailUrl,
            String category,
            String templatePath,
            String blocksSchema,
            Integer sortOrder,
            Boolean active,
            String reason
    ) {}

    public record AdminTemplateCreateRequest(
            String name,
            String description,
            String thumbnailUrl,
            String category,
            String templatePath,
            String blocksSchema,
            Integer sortOrder,
            Boolean active,
            String reason
    ) {}

    public record AdminPaymentActionRequest(String externalRef, String external_ref, String reason, String notes) {}

    public record AdminLandingUpdateRequest(String contentJson, String reason) {}

    public record AdminLandingResponse(String contentJson) {}

    public record AdminPricingUpdateRequest(
            String name,
            BigDecimal amount,
            String currency,
            String displayCurrency,
            String reason
    ) {}

    public record AdminPricingPlanResponse(
            Long id,
            String code,
            String name,
            BigDecimal amount,
            String currency,
            String displayCurrency,
            boolean active,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        static AdminPricingPlanResponse from(PricingPlan plan) {
            return new AdminPricingPlanResponse(
                    plan.getId(),
                    plan.getCode(),
                    plan.getName(),
                    plan.getAmount(),
                    plan.getCurrency(),
                    plan.getDisplayCurrency(),
                    plan.isActive(),
                    plan.getCreatedAt(),
                    plan.getUpdatedAt()
            );
        }
    }

    public record SmallUserResponse(Long id, String phone, String name, String role) {
        static SmallUserResponse from(User user) {
            if (user == null) return null;
            return new SmallUserResponse(user.getId(), user.getPhone(), user.getName(), user.getRole());
        }
    }

    public record SmallTemplateResponse(Long id, String name, String category, String templatePath, boolean active) {
        static SmallTemplateResponse from(Template template) {
            if (template == null) return null;
            return new SmallTemplateResponse(
                    template.getId(),
                    template.getName(),
                    template.getCategory(),
                    template.getTemplatePath(),
                    template.isActive()
            );
        }
    }

    public record AdminUserResponse(
            Long id,
            String phone,
            String name,
            String role,
            boolean active,
            boolean deleted,
            LocalDateTime lastLoginAt,
            String lastLoginIp,
            Integer failedLoginCount,
            LocalDateTime lockedUntil,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        static AdminUserResponse from(User user) {
            return new AdminUserResponse(
                    user.getId(),
                    user.getPhone(),
                    user.getName(),
                    user.getRole(),
                    user.isActive(),
                    user.getDeletedAt() != null,
                    user.getLastLoginAt(),
                    user.getLastLoginIp(),
                    user.getFailedLoginCount(),
                    user.getLockedUntil(),
                    user.getCreatedAt(),
                    user.getUpdatedAt()
            );
        }
    }

    public record AdminEventResponse(
            Long id,
            SmallUserResponse user,
            SmallTemplateResponse template,
            String title,
            String person1,
            String person2,
            LocalDateTime eventDate,
            String location,
            String coverImageUrl,
            String slug,
            String status,
            String publicUrl,
            String previewUrl,
            boolean deleted,
            LocalDateTime rsvpDeadline,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        static AdminEventResponse from(Event event) {
            String slug = event.getSlug();
            String publicUrl = slug != null ? "/e/" + slug : null;
            String previewUrl = slug != null && event.getPreviewToken() != null
                    ? "/e/" + slug + "?preview=" + event.getPreviewToken()
                    : null;
            return new AdminEventResponse(
                    event.getId(),
                    SmallUserResponse.from(event.getUser()),
                    SmallTemplateResponse.from(event.getTemplate()),
                    event.getTitle(),
                    event.getPerson1(),
                    event.getPerson2(),
                    event.getEventDate(),
                    event.getLocation(),
                    event.getCoverImageUrl(),
                    slug,
                    event.getStatus(),
                    publicUrl,
                    previewUrl,
                    event.getDeletedAt() != null,
                    event.getRsvpDeadline(),
                    event.getCreatedAt(),
                    event.getUpdatedAt()
            );
        }
    }

    public record AdminTemplateResponse(
            Long id,
            String name,
            String description,
            String thumbnailUrl,
            String category,
            String templatePath,
            String blocksSchema,
            int sortOrder,
            boolean active,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        static AdminTemplateResponse from(Template template) {
            return new AdminTemplateResponse(
                    template.getId(),
                    template.getName(),
                    template.getDescription(),
                    template.getThumbnailUrl(),
                    template.getCategory(),
                    template.getTemplatePath(),
                    template.getBlocksSchema(),
                    template.getSortOrder(),
                    template.isActive(),
                    template.getCreatedAt(),
                    template.getUpdatedAt()
            );
        }
    }

    public record AdminPaymentResponse(
            Long id,
            SmallUserResponse user,
            AdminEventBriefResponse event,
            Long planId,
            String planCode,
            BigDecimal amount,
            String currency,
            String displayCurrency,
            String method,
            String status,
            String externalRef,
            String receiptUrl,
            LocalDateTime confirmedAt,
            Long confirmedBy,
            String rejectedReason,
            BigDecimal refundedAmount,
            LocalDateTime refundedAt,
            String notes,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        static AdminPaymentResponse from(Payment payment) {
            return new AdminPaymentResponse(
                    payment.getId(),
                    SmallUserResponse.from(payment.getUser()),
                    AdminEventBriefResponse.from(payment.getEvent()),
                    payment.getPlanId(),
                    payment.getPlanCode(),
                    payment.getAmount(),
                    payment.getCurrency(),
                    payment.getDisplayCurrency(),
                    payment.getMethod(),
                    payment.getStatus(),
                    payment.getExternalRef(),
                    payment.getReceiptUrl(),
                    payment.getConfirmedAt(),
                    payment.getConfirmedBy(),
                    payment.getRejectedReason(),
                    payment.getRefundedAmount(),
                    payment.getRefundedAt(),
                    payment.getNotes(),
                    payment.getCreatedAt(),
                    payment.getUpdatedAt()
            );
        }
    }

    public record AdminEventBriefResponse(Long id, String title, String slug, String status) {
        static AdminEventBriefResponse from(Event event) {
            if (event == null) return null;
            return new AdminEventBriefResponse(event.getId(), event.getTitle(), event.getSlug(), event.getStatus());
        }
    }

    public record AdminAuditResponse(
            Long id,
            Long adminUserId,
            String actionCode,
            String targetType,
            String targetId,
            String reason,
            String ip,
            LocalDateTime createdAt
    ) {
        static AdminAuditResponse from(AdminAuditLog log) {
            return new AdminAuditResponse(
                    log.getId(),
                    log.getAdminUserId(),
                    log.getActionCode(),
                    log.getTargetType(),
                    log.getTargetId(),
                    log.getReason(),
                    log.getIp(),
                    log.getCreatedAt()
            );
        }
    }
}
