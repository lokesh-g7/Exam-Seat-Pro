package com.examseat.controller;

import com.examseat.model.Department;
import com.examseat.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = "*")
public class DepartmentController {

    @Autowired
    private DepartmentRepository repository;

    @GetMapping
    public List<Department> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public Department save(@RequestBody Department dept) {
        return repository.save(dept);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Department> update(@PathVariable Long id, @RequestBody Department details) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setDepartmentCode(details.getDepartmentCode());
                    existing.setDepartmentName(details.getDepartmentName());
                    existing.setProgram(details.getProgram());
                    existing.setRegulations(details.getRegulations());
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
