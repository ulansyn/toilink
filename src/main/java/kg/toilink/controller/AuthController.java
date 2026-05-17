package kg.toilink.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import kg.toilink.dto.request.AuthRequest;
import kg.toilink.dto.response.AuthResponse;
import kg.toilink.entity.User;
import kg.toilink.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthRequest req, HttpServletRequest httpReq) {
        User user = userService.loginOrRegister(req.phone(), req.password(), clientIp(httpReq));

        UserDetails details = userService.loadUserByUsername(user.getPhone());
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());

        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);

        HttpSession old = httpReq.getSession(false);
        if (old != null) old.invalidate();
        HttpSession session = httpReq.getSession(true);
        session.setAttribute("SPRING_SECURITY_CONTEXT", ctx);

        return new AuthResponse(user.getPhone(), user.getName(), user.getRole());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/me/name")
    public ResponseEntity<AuthResponse> updateName(
            @RequestBody UpdateNameRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String name = req.name() == null ? "" : req.name().strip();
        if (name.isEmpty() || name.length() > 100) return ResponseEntity.badRequest().build();
        User u = userService.updateName(principal.getUsername(), name);
        return ResponseEntity.ok(new AuthResponse(u.getPhone(), u.getName(), u.getRole()));
    }

    public record UpdateNameRequest(String name) {}

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@AuthenticationPrincipal UserDetails user, HttpServletRequest req) {
        if (user == null) return ResponseEntity.status(401).build();
        String phone = user.getUsername();
        User u = userService.findByPhone(phone).orElse(null);
        if (u == null || u.getDeletedAt() != null || !u.isActive()) {
            HttpSession session = req.getSession(false);
            if (session != null) session.invalidate();
            SecurityContextHolder.clearContext();
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(new AuthResponse(phone, u.getName(), u.getRole()));
    }

    private String clientIp(HttpServletRequest req) {
        String forwarded = req.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return req.getRemoteAddr();
    }
}
