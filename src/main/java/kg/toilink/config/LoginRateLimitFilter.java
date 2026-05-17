package kg.toilink.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(1)
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS = 10;
    private static final long WINDOW_MS = 60_000L;

    private final ConcurrentHashMap<String, Deque<Long>> attempts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!isLoginRequest(request)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = clientIp(request);
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = attempts.computeIfAbsent(ip, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > WINDOW_MS) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= MAX_REQUESTS) {
                response.setStatus(429);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(
                    "{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"Слишком много попыток входа. Попробуйте через минуту.\",\"status\":429}"
                );
                return;
            }
            timestamps.addLast(now);
        }

        chain.doFilter(request, response);
    }

    private boolean isLoginRequest(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod()) && "/api/auth/login".equals(req.getRequestURI());
    }

    private String clientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
