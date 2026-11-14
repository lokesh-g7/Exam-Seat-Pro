package com.examseat.controller;

import com.examseat.model.Semester;
import com.examseat.repository.SemesterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/semesters")
@CrossOrigin(origins = "*")
public class SemesterController {

    @Autowired
    private SemesterRepository repository;

    @GetMapping
    public List<Semester> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public Semester save(@RequestBody Semester sem) {
        return repository.save(sem);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Semester> update(@PathVariable Long id, @RequestBody Semester details) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setSemesterNumber(details.getSemesterNumber());
                    existing.setAcademicYear(details.getAcademicYear());
                    existing.setRegulation(details.getRegulation());
                    existing.setDepartmentCode(details.getDepartmentCode());
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
