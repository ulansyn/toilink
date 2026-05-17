package kg.toilink.service;

import kg.toilink.config.PaymentPricingProperties;
import kg.toilink.entity.PricingPlan;
import kg.toilink.exception.BadRequestException;
import kg.toilink.repository.PricingPlanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private PricingPlanRepository pricingPlanRepository;

    private PricingService pricingService;

    @BeforeEach
    void setUp() {
        pricingService = new PricingService(pricingPlanRepository, new PaymentPricingProperties());
    }

    @Test
    void planByCodeRejectsUnknownPublicPlan() {
        assertThrows(BadRequestException.class, () -> pricingService.planByCode("HACK"));
    }

    @Test
    void planByCodeDoesNotFallbackToActivationForMissingPublicPlan() {
        when(pricingPlanRepository.findByCodeAndActiveTrue("TOI_PRO")).thenReturn(Optional.empty());

        assertThrows(BadRequestException.class, () -> pricingService.planByCode("TOI_PRO"));
    }

    @Test
    void updateFreePlanAllowsZeroAmount() {
        when(pricingPlanRepository.findByCode("FREE")).thenReturn(Optional.empty());
        when(pricingPlanRepository.save(any(PricingPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        pricingService.updatePlan("FREE", BigDecimal.ZERO, "KGS", "сом", "Старт");

        ArgumentCaptor<PricingPlan> captor = ArgumentCaptor.forClass(PricingPlan.class);
        verify(pricingPlanRepository).save(captor.capture());
        assertEquals("FREE", captor.getValue().getCode());
        assertEquals(new BigDecimal("0.00"), captor.getValue().getAmount());
    }

    @Test
    void updatePaidPlanRejectsZeroAmount() {
        assertThrows(BadRequestException.class,
                () -> pricingService.updatePlan("LINK", BigDecimal.ZERO, "KGS", "сом", "Той"));
    }

    @Test
    void eventPlanDefaultsToFreeForMissingOrUnknownCode() {
        assertEquals("FREE", pricingService.normalizeEventPlanCode(null));
        assertEquals("FREE", pricingService.normalizeEventPlanCode("legacy"));
    }

    @Test
    void planFeaturesMatchPublishedTiers() {
        assertEquals(30, pricingService.guestLimit("FREE"));
        assertEquals(150, pricingService.guestLimit("LINK"));
        assertEquals(Integer.MAX_VALUE, pricingService.guestLimit("TOI_PRO"));
        assertEquals(false, pricingService.allowsSeating("LINK"));
        assertEquals(true, pricingService.allowsSeating("TOI_PRO"));
        assertEquals(false, pricingService.allowsPersonalLinks("FREE"));
        assertEquals(true, pricingService.allowsPersonalLinks("TOI_PRO"));
    }

    @Test
    void guestCapacityRejectsOverLimitIncludingCompanion() {
        assertThrows(BadRequestException.class,
                () -> pricingService.requireGuestCapacity("FREE", 29, 2));
    }
}
