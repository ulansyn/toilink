package kg.toilink.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_API = {
            "/api/auth/**",
            "/api/public/**"
    };

    private static final String[] PUBLIC_PAGES_AND_ASSETS = {
            "/",
            "/*.html",
            "/e/**",
            "/templates/**",
            "/css/**",
            "/js/**",
            "/fonts/**",
            "/images/**",
            "/uploads/**",
            "/sw.js",
            "/manifest.webmanifest",
            "/robots.txt",
            "/sitemap.xml",
            "/favicon.ico",
            "/error"
    };

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        HttpSessionSecurityContextRepository repository = new HttpSessionSecurityContextRepository();
        repository.setAllowSessionCreation(true);
        return repository;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           SecurityContextRepository securityContextRepository) throws Exception {
        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        requestHandler.setCsrfRequestAttributeName(null);

        http
            .httpBasic(httpBasic -> httpBasic.disable())
            .formLogin(formLogin -> formLogin.disable())
            .logout(logout -> logout.disable())
            .requestCache(requestCache -> requestCache.disable())
            .securityContext(context -> context
                .securityContextRepository(securityContextRepository)
                .requireExplicitSave(true)
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                .sessionFixation(fixation -> fixation.changeSessionId())
            )
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(requestHandler)
                .ignoringRequestMatchers("/api/**")
            )
            .headers(headers -> headers
                .contentTypeOptions(Customizer.withDefaults())
                .frameOptions(frameOptions -> frameOptions.sameOrigin())
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31_536_000)
                )
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(PUBLIC_API).permitAll()
                .requestMatchers(HttpMethod.POST, "/api/admin/users/*/block", "/api/admin/users/*/unblock")
                    .hasAuthority("ROLE_SUPERADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/admin/users/*/role", "/api/admin/pricing/**")
                    .hasAuthority("ROLE_SUPERADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/admin/users/*")
                    .hasAuthority("ROLE_SUPERADMIN")
                .requestMatchers("/api/admin/**").hasAnyAuthority("ROLE_SUPERADMIN", "ROLE_MANAGER")
                .requestMatchers("/api/organizer/**").authenticated()
                .requestMatchers("/api/**").denyAll()
                .requestMatchers(PUBLIC_PAGES_AND_ASSETS).permitAll()
                .anyRequest().denyAll()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(jsonAuthenticationEntryPoint())
                .accessDeniedHandler(jsonAccessDeniedHandler())
            );
        return http.build();
    }

    private AuthenticationEntryPoint jsonAuthenticationEntryPoint() {
        return (request, response, exception) ->
                writeJsonError(response, 401, "UNAUTHORIZED", "Authentication required");
    }

    private AccessDeniedHandler jsonAccessDeniedHandler() {
        return (request, response, exception) ->
                writeJsonError(response, 403, "FORBIDDEN", "Access denied");
    }

    private void writeJsonError(HttpServletResponse response,
                                int status,
                                String error,
                                String message) throws java.io.IOException {
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"error":"%s","message":"%s","status":%d}
                """.formatted(error, message, status).strip());
    }
}
