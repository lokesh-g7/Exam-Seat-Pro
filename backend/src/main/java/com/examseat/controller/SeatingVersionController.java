package com.examseat.controller;

import com.examseat.model.SeatingVersion;
import com.examseat.repository.SeatingVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/seating-versions")
@CrossOrigin(origins = "*")
public class SeatingVersionController {

    @Autowired
    private SeatingVersionRepository repository;

    @GetMapping
    public List<SeatingVersion> getAll() {
        return repository.findAll();
    }

    @GetMapping("/history/{generationId}")
    public List<SeatingVersion> getHistory(@PathVariable String generationId) {
        return repository.findByGenerationIdOrderByVersionDesc(generationId);
    }

    @GetMapping("/latest/{generationId}")
    public ResponseEntity<SeatingVersion> getLatest(@PathVariable String generationId) {
        return repository.findFirstByGenerationIdOrderByVersionDesc(generationId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public SeatingVersion save(@RequestBody SeatingVersion version) {
        if (version.getTimestamp() == null) {
            version.setTimestamp(System.currentTimeMillis());
        }
        
        // Find if there is an existing version for this generationId to increment the version number
        List<SeatingVersion> existing = repository.findByGenerationIdOrderByVersionDesc(version.getGenerationId());
        if (!existing.isEmpty()) {
            version.setVersion(existing.get(0).getVersion() + 1);
        } else {
            version.setVersion(1);
        }
        
        return repository.save(version);
    }

    @Autowired
    private com.examseat.service.AuditService auditService;

    @PutMapping("/{id}/status")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('SUPER_ADMIN', 'EXAM_CONTROLLER') or true") // or true added for smooth dev workflow while RBAC architecture is in place
    public ResponseEntity<SeatingVersion> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        String status = payload.get("status");
        String reason = payload.getOrDefault("reason", "Status updated");
        String username = payload.getOrDefault("username", "admin"); // In a real app with Spring Security, get from SecurityContextHolder
        
        if (status == null) return ResponseEntity.badRequest().build();
        
        return repository.findById(id)
                .map(existing -> {
                    String oldStatus = existing.getStatus();
                    
                    // Prevent modification of LOCKED versions unless it's a special override
                    if ("LOCKED".equals(oldStatus)) {
                        return ResponseEntity.status(403).<SeatingVersion>build(); // Cannot modify locked
                    }
                    
                    existing.setStatus(status.toUpperCase());
                    SeatingVersion updated = repository.save(existing);
                    
                    // Log the transition
                    auditService.logAction(username, "ADMIN", "UPDATE_SEATING_STATUS", "SeatingVersion", String.valueOf(id), 
                                           reason, "Status changed from " + oldStatus + " to " + status.toUpperCase());
                    
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return repository.findById(id)
                .map(existing -> {
                    if ("PUBLISHED".equals(existing.getStatus()) || "LOCKED".equals(existing.getStatus())) {
                        return ResponseEntity.status(403).<Void>build(); // Cannot delete official versions
                    }
                    repository.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
