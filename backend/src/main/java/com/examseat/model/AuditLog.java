package com.examseat.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Data
@NoArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String username;

    private String role;

    @Column(nullable = false)
    private String action; // e.g. "GENERATE_SEATING", "APPROVE_SEATING", "UPLOAD_TIMETABLE"

    @Column(nullable = false)
    private LocalDateTime timestamp;

    private String entityType; // e.g. "SeatingVersion"
    private String entityId;

    @Column(length = 1000)
    private String reason;
    
    @Column(length = 2000)
    private String details; // optional JSON string for old/new values

    public AuditLog(String username, String role, String action, String entityType, String entityId, String reason, String details) {
        this.username = username;
        this.role = role;
        this.action = action;
        this.timestamp = LocalDateTime.now();
        this.entityType = entityType;
        this.entityId = entityId;
        this.reason = reason;
        this.details = details;
    }
}
