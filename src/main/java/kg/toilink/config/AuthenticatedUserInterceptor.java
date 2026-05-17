package kg.toilink.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import kg.toilink.entity.User;
import kg.toilink.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class AuthenticatedUserInterceptor implements HandlerInterceptor {

    private final UserRepository userRepository;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserDetails details)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }

        User user = userRepository.findByPhone(details.getUsername()).orElse(null);
        if (user == null || user.getDeletedAt() != null || !user.isActive()) {
            clearSession(request);
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }

        if (isAdminRequest(request) && !isAdminRole(user.getRole())) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return false;
        }

        return true;
    }

    private boolean isAdminRole(String role) {
        return "SUPERADMIN".equals(role) || "MANAGER".equals(role);
    }

    private boolean isAdminRequest(HttpServletRequest request) {
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && path.startsWith(contextPath)) {
            path = path.substring(contextPath.length());
        }
        return path.equals("/api/admin") || path.startsWith("/api/admin/");
    }

    private void clearSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }
}
