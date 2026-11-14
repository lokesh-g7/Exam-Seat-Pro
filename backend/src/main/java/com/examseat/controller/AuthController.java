package com.examseat.controller;

import com.examseat.config.JwtHelper;
import com.examseat.model.User;
import com.examseat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private JwtHelper jwtHelper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        try {
            String username = credentials.get("username");
            String password = credentials.get("password");

            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password)
            );

            UserDetails userDetails = userDetailsService.loadUserByUsername(username);
            User user = userRepository.findByUsername(username);

            String token = jwtHelper.generateToken(username, user.getRole());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("user", buildUserMap(user));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> userData) {
        try {
            String username = userData.get("username");
            String password = userData.get("password");
            String role = userData.get("role");
            String name = userData.get("name");
            String dept = userData.get("dept");
            String regNo = userData.get("regNo");
            Integer year = userData.get("year") != null ? Integer.parseInt(userData.get("year")) : null;

            if (userRepository.findByUsername(username) != null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Username already exists"));
            }

            // Also check if regNo is already registered (student portal uses regNo as unique key)
            if (regNo != null && !regNo.isEmpty() && userRepository.findByRegNo(regNo).isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Registration number already registered"));
            }

            User user = new User();
            user.setUsername(username);
            user.setPassword(passwordEncoder.encode(password));
            user.setRole(role != null ? role.toUpperCase() : "STUDENT");
            user.setName(name);
            user.setDept(dept);
            user.setYear(year);
            user.setRegNo(regNo);

            userRepository.save(user);

            String token = jwtHelper.generateToken(username, user.getRole());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("user", buildUserMap(user));

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Registration failed: " + e.getMessage()));
        }
    }

    private Map<String, Object> buildUserMap(User user) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", user.getId());
        map.put("username", user.getUsername());
        map.put("name", user.getName() != null ? user.getName() : "");
        map.put("role", user.getRole().toLowerCase());
        map.put("dept", user.getDept() != null ? user.getDept() : "");
        map.put("year", user.getYear() != null ? user.getYear() : 0);
        map.put("regNo", user.getRegNo() != null ? user.getRegNo() : "");
        return map;
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader("Authorization") String authHeader) {
        try {
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                if (jwtHelper.validateToken(token)) {
                    String username = jwtHelper.extractUsername(token);
                    String role = jwtHelper.extractRole(token);
                    return ResponseEntity.ok(Map.of("valid", true, "username", username, "role", role));
                }
            }
            return ResponseEntity.ok(Map.of("valid", false));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("valid", false));
        }
    }
}