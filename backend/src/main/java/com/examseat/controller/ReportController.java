package com.examseat.controller;

import com.examseat.model.SeatingVersion;
import com.examseat.repository.SeatingVersionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    @Autowired
    private SeatingVersionRepository seatingVersionRepository;

    @GetMapping("/published")
    public ResponseEntity<List<SeatingVersion>> getPublishedSeating() {
        // Enforce the rule: reports MUST only be generated from PUBLISHED allocations.
        List<SeatingVersion> publishedVersions = seatingVersionRepository.findByStatus("PUBLISHED");
        if (publishedVersions.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(publishedVersions);
    }
}
