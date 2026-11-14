package com.examseat.controller;

import com.examseat.model.Allocation;
import com.examseat.service.AllocationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/allocations")
public class AllocationController {

    @Autowired
    private AllocationService allocationService;

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "ExamSeat Pro Seating Allocation Engine",
            "timestamp", System.currentTimeMillis()
        ));
    }

    @PostMapping
    public ResponseEntity<?> saveAllocations(@RequestBody Map<String, List<Allocation>> payload) {
        try {
            List<Allocation> allocations = payload.get("allocations");
            if (allocations == null) return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Invalid payload: missing allocations list"));
            
            List<Allocation> saved = allocationService.saveAllocations(allocations);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Successfully saved " + saved.size() + " allocations to MySQL database."
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "error", e.getMessage() != null ? e.getMessage() : "Database error while saving allocations"
            ));
        }
    }

    @GetMapping("/{regNo}")
    public ResponseEntity<?> getAllocation(@PathVariable String regNo) {
        return allocationService.findByRegNo(regNo)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public List<Allocation> getAllAllocations() {
        return allocationService.getAllAllocations();
    }

    @DeleteMapping
    public void deleteAll() {
        allocationService.deleteAll();
    }
}
