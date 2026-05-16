package kg.toilink.repository;

import kg.toilink.entity.PricingPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PricingPlanRepository extends JpaRepository<PricingPlan, Long> {

    Optional<PricingPlan> findByCode(String code);

    Optional<PricingPlan> findByCodeAndActiveTrue(String code);
}
