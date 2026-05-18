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
@Order(0)
public class RsvpRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQUESTS = 10;
    private static final long WINDOW_MS = 60_000L;
    private static final long RETRY_AFTER_SECONDS = WINDOW_MS / 1_000L;

    private final ConcurrentHashMap<String, Deque<Long>> timestampsByIp = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!isRsvpRequest(request)) {
            chain.doFilter(request, response);
            return;
        }

        String ip = clientIp(request);
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = timestampsByIp.computeIfAbsent(ip, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            prune(timestamps, now);
            if (timestamps.size() >= MAX_REQUESTS) {
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(RETRY_AFTER_SECONDS));
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(
                    "{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"Слишком много запросов. Попробуйте через минуту.\",\"status\":429}"
                );
                return;
            }
            timestamps.addLast(now);
        }

        chain.doFilter(request, response);
    }

    private boolean isRsvpRequest(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod())
                && req.getRequestURI().matches("^/api/public/events/[^/]+/rsvp$");
    }

    private String clientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return req.getRemoteAddr();
    }

    private void prune(Deque<Long> timestamps, long now) {
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() > WINDOW_MS) {
            timestamps.pollFirst();
        }
    }
}
