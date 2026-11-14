package com.examseat.controller;

import com.examseat.model.Subject;
import com.examseat.repository.SubjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
@CrossOrigin(origins = "*")
public class SubjectController {

    @Autowired
    private SubjectRepository repository;

    @GetMapping
    public List<Subject> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public Subject save(@RequestBody Subject subject) {
        return repository.save(subject);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Subject> update(@PathVariable Long id, @RequestBody Subject details) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setSubjectCode(details.getSubjectCode());
                    existing.setSubjectName(details.getSubjectName());
                    existing.setDepartmentCode(details.getDepartmentCode());
                    existing.setSemester(details.getSemester());
                    existing.setRegulation(details.getRegulation());
                    existing.setExamType(details.getExamType());
                    existing.setActive(details.isActive());
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
