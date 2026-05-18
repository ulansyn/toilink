package kg.toilink.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;

class LoginRateLimitFilterTest {

    @Test
    void successfulLoginsDoNotTripRateLimit() throws Exception {
        LoginRateLimitFilter filter = new LoginRateLimitFilter();

        for (int i = 0; i < 15; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilter(loginRequest(), response, successfulChain());

            assertEquals(200, response.getStatus());
        }
    }

    @Test
    void failedLoginsAreRateLimited() throws Exception {
        LoginRateLimitFilter filter = new LoginRateLimitFilter();
        AtomicInteger chainCalls = new AtomicInteger();

        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            filter.doFilter(loginRequest(), response, failingChain(chainCalls));
            assertEquals(400, response.getStatus());
        }

        MockHttpServletResponse blocked = new MockHttpServletResponse();
        filter.doFilter(loginRequest(), blocked, failingChain(chainCalls));

        assertEquals(429, blocked.getStatus());
        assertEquals("60", blocked.getHeader("Retry-After"));
        assertEquals(10, chainCalls.get());
    }

    private MockHttpServletRequest loginRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("127.0.0.1");
        return request;
    }

    private FilterChain successfulChain() {
        return (request, response) -> ((HttpServletResponse) response).setStatus(200);
    }

    private FilterChain failingChain(AtomicInteger chainCalls) {
        return (request, response) -> {
            chainCalls.incrementAndGet();
            ((HttpServletResponse) response).setStatus(400);
        };
    }
}
