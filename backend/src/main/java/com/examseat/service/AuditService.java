package com.examseat.service;

import com.examseat.model.AuditLog;
import com.examseat.repository.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AuditService {

    @Autowired
    private AuditLogRepository auditLogRepository;

    public void logAction(String username, String role, String action, String entityType, String entityId, String reason, String details) {
        AuditLog log = new AuditLog(username, role, action, entityType, entityId, reason, details);
        auditLogRepository.save(log);
    }
    
    public List<AuditLog> getAllLogs() {
        // In a real production system, this should be paginated
        return auditLogRepository.findAll();
    }
}
