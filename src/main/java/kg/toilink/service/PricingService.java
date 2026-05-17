package kg.toilink.service;

import kg.toilink.config.PaymentPricingProperties;
import kg.toilink.entity.PricingPlan;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.PricingPlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PricingService {

    public static final String ACTIVATION_CODE = "ACTIVATION";
    public static final String FREE_CODE = "FREE";
    public static final String LINK_CODE = "LINK";
    public static final String TOI_PRO_CODE = "TOI_PRO";
    public static final int FREE_GUEST_LIMIT = 30;
    public static final int LINK_GUEST_LIMIT = 150;

    public static final List<String> PUBLIC_PLAN_CODES = List.of(FREE_CODE, LINK_CODE, TOI_PRO_CODE);

    private final PricingPlanRepository pricingPlanRepository;
    private final PaymentPricingProperties fallbackPricing;

    @Transactional(readOnly = true)
    public PricingPlan activationPlan() {
        return pricingPlanRepository.findByCodeAndActiveTrue(ACTIVATION_CODE)
                .orElseGet(this::fallbackActivationPlan);
    }

    @Transactional(readOnly = true)
    public PricingPlan planByCode(String code) {
        String normalizedCode = normalizePublicPlanCode(code);
        return pricingPlanRepository.findByCodeAndActiveTrue(normalizedCode)
                .orElseThrow(() -> new BadRequestException("Тариф недоступен: " + normalizedCode));
    }

    @Transactional(readOnly = true)
    public List<PricingPlan> allPlans() {
        return pricingPlanRepository.findAllByActiveTrueOrderByAmountAsc();
    }

    @Transactional
    public PricingPlan updatePlan(String code, BigDecimal amount, String currency, String displayCurrency, String name) {
        String normalizedCode = normalizePublicPlanCode(code);
        BigDecimal normalizedAmount = normalizePlanAmount(normalizedCode, amount);
        String normalizedCurrency = normalizeCurrency(currency);
        String normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
        String normalizedName = normalizeName(name);

        PricingPlan plan = pricingPlanRepository.findByCode(normalizedCode)
                .orElseGet(() -> PricingPlan.builder().code(normalizedCode).build());
        plan.setName(normalizedName);
        plan.setAmount(normalizedAmount);
        plan.setCurrency(normalizedCurrency);
        plan.setDisplayCurrency(normalizedDisplayCurrency);
        plan.setActive(true);
        return pricingPlanRepository.save(plan);
    }

    @Transactional
    public PricingPlan updateActivationPlan(BigDecimal amount,
                                            String currency,
                                            String displayCurrency,
                                            String name) {
        BigDecimal normalizedAmount = normalizePositiveAmount(amount);
        String normalizedCurrency = normalizeCurrency(currency);
        String normalizedDisplayCurrency = normalizeDisplayCurrency(displayCurrency);
        String normalizedName = normalizeName(name);

        PricingPlan plan = pricingPlanRepository.findByCode(ACTIVATION_CODE)
                .orElseGet(() -> PricingPlan.builder()
                        .code(ACTIVATION_CODE)
                        .build());
        plan.setName(normalizedName);
        plan.setAmount(normalizedAmount);
        plan.setCurrency(normalizedCurrency);
        plan.setDisplayCurrency(normalizedDisplayCurrency);
        plan.setActive(true);
        return pricingPlanRepository.save(plan);
    }

    @Transactional(readOnly = true)
    public String displayCurrencyFor(Long planId, String currency) {
        if (planId != null) {
            return pricingPlanRepository.findById(planId)
                    .map(PricingPlan::getDisplayCurrency)
                    .orElseGet(() -> displayCurrencyForCode(currency));
        }
        return displayCurrencyForCode(currency);
    }

    public String formatPrice(BigDecimal amount) {
        if (amount == null) return "";
        return amount.setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    public String normalizePublicPlanCode(String code) {
        if (code == null || code.isBlank()) {
            throw new BadRequestException("Тариф обязателен");
        }
        String normalized = code.trim().toUpperCase();
        if (!PUBLIC_PLAN_CODES.contains(normalized)) {
            throw new BadRequestException("Неизвестный тариф: " + normalized);
        }
        return normalized;
    }

    public String normalizeEventPlanCode(String code) {
        if (code == null || code.isBlank()) {
            return FREE_CODE;
        }
        String normalized = code.trim().toUpperCase();
        return PUBLIC_PLAN_CODES.contains(normalized) ? normalized : FREE_CODE;
    }

    public int guestLimit(String planCode) {
        return switch (normalizeEventPlanCode(planCode)) {
            case FREE_CODE -> FREE_GUEST_LIMIT;
            case LINK_CODE -> LINK_GUEST_LIMIT;
            default -> Integer.MAX_VALUE;
        };
    }

    public boolean hasGuestLimit(String planCode) {
        return guestLimit(planCode) != Integer.MAX_VALUE;
    }

    public boolean allowsPersonalLinks(String planCode) {
        return TOI_PRO_CODE.equals(normalizeEventPlanCode(planCode));
    }

    public boolean allowsSeating(String planCode) {
        return TOI_PRO_CODE.equals(normalizeEventPlanCode(planCode));
    }

    public void requireSeating(String planCode) {
        if (!allowsSeating(planCode)) {
            throw new BadRequestException(
                    "Рассадка гостей доступна в тарифе Toi Pro. Перейдите на Toi Pro, чтобы создавать столы и назначать места."
            );
        }
    }

    public void requireGuestCapacity(String planCode, long currentGuests, int guestsToAdd) {
        if (guestsToAdd <= 0 || !hasGuestLimit(planCode)) return;
        int limit = guestLimit(planCode);
        if (currentGuests + guestsToAdd > limit) {
            throw new BadRequestException(
                    "Достигнут лимит гостей для вашего тарифа (" + limit + "). " +
                            "Перейдите на более высокий тариф для добавления новых гостей."
            );
        }
    }

    private PricingPlan fallbackActivationPlan() {
        return PricingPlan.builder()
                .code(ACTIVATION_CODE)
                .name("Активация события")
                .amount(fallbackPricing.getAmount())
                .currency(fallbackPricing.getCurrency())
                .displayCurrency(fallbackPricing.getDisplayCurrency())
                .active(true)
                .build();
    }

    private BigDecimal normalizePlanAmount(String code, BigDecimal amount) {
        if (amount == null) {
            throw new BadRequestException("Цена обязательна");
        }
        BigDecimal normalized = amount.setScale(2, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Цена не может быть отрицательной");
        }
        if (!FREE_CODE.equals(code) && normalized.compareTo(BigDecimal.ZERO) == 0) {
            throw new BadRequestException("Цена платного тарифа должна быть больше нуля");
        }
        return normalized;
    }

    private BigDecimal normalizePositiveAmount(BigDecimal amount) {
        if (amount == null) {
            throw new BadRequestException("Цена обязательна");
        }
        BigDecimal normalized = amount.setScale(2, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Цена должна быть больше нуля");
        }
        return normalized;
    }

    private String normalizeCurrency(String currency) {
        String value = currency == null ? "KGS" : currency.trim().toUpperCase();
        if (value.isBlank() || value.length() > 10) {
            throw new BadRequestException("Валюта должна быть от 1 до 10 символов");
        }
        return value;
    }

    private String normalizeDisplayCurrency(String displayCurrency) {
        String value = displayCurrency == null ? "сом" : displayCurrency.trim();
        if (value.isBlank() || value.length() > 20) {
            throw new BadRequestException("Отображаемая валюта должна быть от 1 до 20 символов");
        }
        return value;
    }

    private String normalizeName(String name) {
        String value = name == null || name.isBlank() ? "Активация события" : name.trim();
        if (value.length() > 100) {
            throw new BadRequestException("Название тарифа не должно превышать 100 символов");
        }
        return value;
    }

    private String displayCurrencyForCode(String currency) {
        return "KGS".equalsIgnoreCase(currency) ? "сом" : currency;
    }
}
