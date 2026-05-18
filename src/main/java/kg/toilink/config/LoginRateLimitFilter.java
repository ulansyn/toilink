package kg.toilink.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(1)
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_FAILED_REQUESTS = 10;
    private static final long WINDOW_MS = 60_000L;
    private static final long RETRY_AFTER_SECONDS = WINDOW_MS / 1_000L;
    private static final int MAX_TRACKED_IPS = 50_000;

    private final ConcurrentHashMap<String, Deque<Long>> failedAttempts = new ConcurrentHashMap<>();

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
        Deque<Long> timestamps = failedAttempts.computeIfAbsent(ip, k -> new ArrayDeque<>());

        synchronized (timestamps) {
            prune(timestamps, now);
            if (timestamps.size() >= MAX_FAILED_REQUESTS) {
                response.setStatus(429);
                response.setHeader("Retry-After", String.valueOf(RETRY_AFTER_SECONDS));
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write(
                    "{\"error\":\"TOO_MANY_REQUESTS\",\"message\":\"Слишком много попыток входа. Попробуйте через минуту.\",\"status\":429}"
                );
                return;
            }
        }

        chain.doFilter(request, response);

        synchronized (timestamps) {
            if (response.getStatus() >= 400) {
                if (failedAttempts.size() < MAX_TRACKED_IPS) {
                    timestamps.addLast(now);
                }
            } else {
                timestamps.clear();
            }
        }
    }

    @Scheduled(fixedDelayString = "PT5M")
    void cleanup() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Deque<Long>>> it = failedAttempts.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Deque<Long>> entry = it.next();
            Deque<Long> timestamps = entry.getValue();
            synchronized (timestamps) {
                prune(timestamps, now);
                if (timestamps.isEmpty()) it.remove();
            }
        }
    }

    private boolean isLoginRequest(HttpServletRequest req) {
        return "POST".equalsIgnoreCase(req.getMethod()) && "/api/auth/login".equals(req.getRequestURI());
    }

    private String clientIp(HttpServletRequest req) {
        return req.getRemoteAddr();
    }

    private void prune(Deque<Long> timestamps, long now) {
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() > WINDOW_MS) {
            timestamps.pollFirst();
        }
    }
}
