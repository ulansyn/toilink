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

@Service
@RequiredArgsConstructor
public class PricingService {

    public static final String ACTIVATION_CODE = "ACTIVATION";

    private final PricingPlanRepository pricingPlanRepository;
    private final PaymentPricingProperties fallbackPricing;

    @Transactional(readOnly = true)
    public PricingPlan activationPlan() {
        return pricingPlanRepository.findByCodeAndActiveTrue(ACTIVATION_CODE)
                .orElseGet(this::fallbackActivationPlan);
    }

    @Transactional
    public PricingPlan updateActivationPlan(BigDecimal amount,
                                            String currency,
                                            String displayCurrency,
                                            String name) {
        BigDecimal normalizedAmount = normalizeAmount(amount);
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

    private BigDecimal normalizeAmount(BigDecimal amount) {
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
