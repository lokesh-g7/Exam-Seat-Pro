package com.examseat.controller;

import com.examseat.model.Invigilator;
import com.examseat.repository.InvigilatorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/invigilators")
@CrossOrigin(origins = "*")
public class InvigilatorController {

    @Autowired
    private InvigilatorRepository repository;

    @GetMapping
    public List<Invigilator> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public Invigilator save(@RequestBody Invigilator invigilator) {
        return repository.save(invigilator);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Invigilator> update(@PathVariable Long id, @RequestBody Invigilator details) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setName(details.getName());
                    existing.setEmail(details.getEmail());
                    existing.setDepartmentCode(details.getDepartmentCode());
                    existing.setAvailabilityStatus(details.getAvailabilityStatus());
                    existing.setMaxWorkloadHours(details.getMaxWorkloadHours());
                    existing.setAssignedSessionsJson(details.getAssignedSessionsJson());
                    return ResponseEntity.ok(repository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
