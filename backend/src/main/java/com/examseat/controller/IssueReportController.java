package com.examseat.controller;

import com.examseat.model.IssueReport;
import com.examseat.repository.IssueReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/issues")
@CrossOrigin(origins = "*")
public class IssueReportController {

    @Autowired
    private IssueReportRepository issueReportRepository;

    /**
     * Submit an issue from the student portal.
     */
    @PostMapping
    public ResponseEntity<?> submitIssue(@RequestBody Map<String, Object> payload) {
        try {
            String regNo = (String) payload.get("regNo");
            String message = (String) payload.get("message");
            String studentName = (String) payload.get("studentName");
            String dept = (String) payload.get("dept");
            String category = (String) payload.get("category");
            
            Integer year = null;
            if (payload.get("year") != null) {
                try {
                    year = Integer.parseInt(payload.get("year").toString());
                } catch (Exception ignored) {}
            }

            if (regNo == null || regNo.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Student registration number is required"));
            }
            if (message == null || message.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Message description is required"));
            }

            IssueReport issue = new IssueReport();
            issue.setRegNo(regNo.trim());
            issue.setMessage(message.trim());
            issue.setStudentName(studentName != null ? studentName.trim() : "Student");
            issue.setDept(dept != null ? dept.trim() : "");
            issue.setYear(year);
            issue.setCategory(category != null ? category.trim() : "General");
            issue.setStatus("OPEN");
            issue.setCreatedAt(LocalDateTime.now());

            IssueReport saved = issueReportRepository.save(issue);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Your issue has been reported to the exam administration.",
                    "issue", saved
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to submit issue: " + e.getMessage()));
        }
    }

    /**
     * Get all reported issues (ordered by newest first).
     */
    @GetMapping
    public List<IssueReport> getAllIssues() {
        return issueReportRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Get summary counts of open issues.
     */
    @GetMapping("/summary")
    public ResponseEntity<?> getIssuesSummary() {
        long openCount = issueReportRepository.countByStatus("OPEN");
        long inProgressCount = issueReportRepository.countByStatus("IN_PROGRESS");
        long resolvedCount = issueReportRepository.countByStatus("RESOLVED");
        return ResponseEntity.ok(Map.of(
                "openCount", openCount,
                "inProgressCount", inProgressCount,
                "resolvedCount", resolvedCount,
                "totalCount", openCount + inProgressCount + resolvedCount
        ));
    }

    /**
     * Update issue status or admin notes.
     */
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateIssueStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload
    ) {
        return issueReportRepository.findById(id).map(issue -> {
            if (payload.containsKey("status")) {
                issue.setStatus(payload.get("status").toUpperCase());
            }
            if (payload.containsKey("adminNotes")) {
                issue.setAdminNotes(payload.get("adminNotes"));
            }
            IssueReport updated = issueReportRepository.save(issue);
            return ResponseEntity.ok(updated);
        }).orElse(ResponseEntity.notFound().build());
    }
}

