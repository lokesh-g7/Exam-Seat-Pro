package com.examseat.controller;

import com.examseat.model.ExamHall;
import com.examseat.repository.ExamHallRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/halls")
@CrossOrigin(origins = "*")
public class ExamHallController {

    @Autowired
    private ExamHallRepository repository;

    @GetMapping
    public List<ExamHall> getAll() {
        return repository.findAll();
    }

    @PostMapping
    public ExamHall save(@RequestBody ExamHall hall) {
        return repository.save(hall);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExamHall> update(@PathVariable Long id, @RequestBody ExamHall details) {
        return repository.findById(id)
                .map(existing -> {
                    existing.setHallName(details.getHallName());
                    existing.setRowsCount(details.getRowsCount());
                    existing.setColumnsCount(details.getColumnsCount());
                    existing.setSeatsPerTable(details.getSeatsPerTable());
                    existing.setBlockedSeats(details.getBlockedSeats());
                    existing.setAccessibilitySeats(details.getAccessibilitySeats());
                    existing.setReservedSeats(details.getReservedSeats());
                    existing.setAllowedExamTypes(details.getAllowedExamTypes());
                    existing.setSeatingModes(details.getSeatingModes());
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
