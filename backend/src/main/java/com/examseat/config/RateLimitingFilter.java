package com.examseat.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Thread-safe in-memory rate limiter filter.
 * Protects auth and API endpoints against brute force attacks, credential stuffing, and DoS.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitingFilter extends OncePerRequestFilter {

    private static final int AUTH_LIMIT_PER_MINUTE = 20;
    private static final int API_LIMIT_PER_MINUTE = 200;

    private static class RateWindow {
        final long windowStart;
        final AtomicInteger count;

        RateWindow(long windowStart) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(1);
        }
    }

    private final ConcurrentHashMap<String, RateWindow> authRequestCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, RateWindow> apiRequestCounts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();
        String clientIp = getClientIp(request);

        // Periodic cleanup if map grows large (e.g. > 10,000 entries)
        if (authRequestCounts.size() > 5000) cleanupExpired(authRequestCounts);
        if (apiRequestCounts.size() > 5000) cleanupExpired(apiRequestCounts);

        // 1. Strict rate limit on authentication endpoints
        if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register")) {
            if (!isAllowed(authRequestCounts, clientIp, AUTH_LIMIT_PER_MINUTE)) {
                sendRateLimitResponse(response, "Too many authentication attempts. Please try again in 1 minute.");
                return;
            }
        }

        // 2. General rate limit on /api/ endpoints
        if (path.startsWith("/api/")) {
            if (!isAllowed(apiRequestCounts, clientIp, API_LIMIT_PER_MINUTE)) {
                sendRateLimitResponse(response, "Rate limit exceeded. Please throttle your requests.");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isAllowed(ConcurrentHashMap<String, RateWindow> map, String key, int limit) {
        long now = System.currentTimeMillis();
        RateWindow window = map.compute(key, (k, existing) -> {
            if (existing == null || now - existing.windowStart > 60_000) {
                return new RateWindow(now);
            }
            existing.count.incrementAndGet();
            return existing;
        });
        return window.count.get() <= limit;
    }

    private void cleanupExpired(ConcurrentHashMap<String, RateWindow> map) {
        long now = System.currentTimeMillis();
        map.entrySet().removeIf(entry -> now - entry.getValue().windowStart > 60_000);
    }

    private void sendRateLimitResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(429); // 429 Too Many Requests
        response.setContentType("application/json");
        response.setHeader("Retry-After", "60");
        response.getWriter().write("{\"error\": \"" + message + "\", \"status\": 429}");
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}

