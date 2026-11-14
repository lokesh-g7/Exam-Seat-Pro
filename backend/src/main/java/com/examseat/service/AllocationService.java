package com.examseat.service;

import com.examseat.model.Allocation;
import com.examseat.model.SeatingVersion;
import com.examseat.repository.AllocationRepository;
import com.examseat.repository.SeatingVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class AllocationService {

    @Autowired
    private AllocationRepository allocationRepository;

    @Autowired
    private SeatingVersionRepository seatingVersionRepository;

    @PersistenceContext
    private EntityManager entityManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public List<Allocation> saveAllocations(List<Allocation> allocations) {
        // Delete all existing allocations
        allocationRepository.deleteAll();
        // Flush to DB immediately so DELETE is executed before INSERT
        // (prevents UNIQUE constraint violation on re-publish within the same transaction)
        entityManager.flush();
        entityManager.clear();

        // Deduplicate by regNo to prevent DataIntegrityViolationException
        java.util.Map<String, Allocation> uniqueMap = new java.util.LinkedHashMap<>();
        for (Allocation a : allocations) {
            if (a.getRegNo() != null && !a.getRegNo().isBlank()) {
                a.setId(null); // Ensure fresh insert
                uniqueMap.put(a.getRegNo().trim().toUpperCase(), a);
            }
        }

        List<Allocation> saved = allocationRepository.saveAll(uniqueMap.values());

        // Update or create published SeatingVersion snapshot so reports and export are authoritative
        try {
            String json = objectMapper.writeValueAsString(saved);
            List<SeatingVersion> publishedList = seatingVersionRepository.findByStatus("PUBLISHED");
            SeatingVersion version;
            if (!publishedList.isEmpty()) {
                version = publishedList.get(0);
                version.setTimestamp(System.currentTimeMillis());
                // Only overwrite allocationsJson if it does not already contain a full 3D seating grid
                if (version.getAllocationsJson() == null || !version.getAllocationsJson().startsWith("[[[")) {
                    version.setAllocationsJson(json);
                }
                version.setVersion(version.getVersion() != null ? version.getVersion() + 1 : 1);
            } else {
                version = SeatingVersion.builder()
                        .generationId("gen_" + System.currentTimeMillis())
                        .version(1)
                        .creator("admin")
                        .timestamp(System.currentTimeMillis())
                        .status("PUBLISHED")
                        .allocationsJson(json)
                        .build();
            }
            seatingVersionRepository.save(version);
        } catch (Exception e) {
            // Log or ignore non-critical snapshot failure
        }

        return saved;
    }

    public Optional<Allocation> findByRegNo(String regNo) {
        if (regNo == null) return Optional.empty();
        String trimmed = regNo.trim();
        Optional<Allocation> direct = allocationRepository.findByRegNo(trimmed);
        if (direct.isPresent()) return direct;
        return allocationRepository.findByRegNoIgnoreCase(trimmed);
    }

    public List<Allocation> getAllAllocations() {
        return allocationRepository.findAll();
    }

    @Transactional
    public void deleteAll() {
        allocationRepository.deleteAll();
        entityManager.flush();
        entityManager.clear();
    }
}
