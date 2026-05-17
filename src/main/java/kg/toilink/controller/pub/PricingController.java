package kg.toilink.controller.pub;

import kg.toilink.entity.PricingPlan;
import kg.toilink.service.PricingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/pricing")
@RequiredArgsConstructor
public class PricingController {

    private static final List<String> PLAN_ORDER = List.of("FREE", "LINK", "TOI_PRO");

    private final PricingService pricingService;

    @GetMapping
    public List<Map<String, Object>> getPlans() {
        Map<String, PricingPlan> byCode = pricingService.allPlans().stream()
                .filter(p -> PLAN_ORDER.contains(p.getCode()))
                .collect(Collectors.toMap(PricingPlan::getCode, p -> p));

        return PLAN_ORDER.stream()
                .filter(byCode::containsKey)
                .map(code -> {
                    PricingPlan plan = byCode.get(code);
                    return Map.<String, Object>of(
                            "code", plan.getCode(),
                            "name", plan.getName(),
                            "amount", plan.getAmount(),
                            "currency", plan.getCurrency(),
                            "displayCurrency", plan.getDisplayCurrency()
                    );
                })
                .collect(Collectors.toList());
    }
}
