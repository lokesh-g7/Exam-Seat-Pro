package com.examseat.controller;

import com.examseat.dto.StudentEntryDto;
import com.examseat.dto.StudentExtractionResponse;
import com.examseat.model.Student;
import com.examseat.service.StudentParserService;
import com.examseat.service.StudentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/students")
@CrossOrigin(origins = "*")
public class StudentController {

    @Autowired
    private StudentService studentService;

    @Autowired
    private StudentParserService studentParserService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadStudents(@RequestBody List<Student> students) {
        try {
            if (students == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "No student payload received"));
            }
            List<Student> saved = studentService.saveAll(students);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload students: " + (e.getMessage() != null ? e.getMessage() : "Unknown error")));
        }
    }

    /**
     * Extract student records from an uploaded PDF (scanned or digital text)
     * using Tesseract OCR.
     */
    @PostMapping(value = "/extract-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> extractStudentsFromPdf(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        }
        try {
            StudentExtractionResponse response = studentParserService.parseStudentPdf(file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to extract student records from PDF: " + e.getMessage()));
        }
    }

    /**
     * Extract student records from an uploaded CSV with empty field validation.
     */
    @PostMapping(value = "/extract-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> extractStudentsFromCsv(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file provided"));
        }
        try {
            StudentExtractionResponse response = studentParserService.parseStudentCsv(file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to parse CSV: " + e.getMessage()));
        }
    }

    /**
     * Save student records after admin review/editing.
     */
    @PostMapping("/save-extracted")
    public ResponseEntity<?> saveExtractedStudents(@RequestBody List<StudentEntryDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No student records provided"));
        }
        List<Student> students = new ArrayList<>();
        int idx = 1;
        for (StudentEntryDto dto : dtos) {
            String regNo = (dto.getRegNo() != null && !dto.getRegNo().isBlank()) 
                    ? dto.getRegNo().trim() 
                    : "STU_" + System.currentTimeMillis() + "_" + idx;

            Student student = new Student();
            student.setSno(dto.getSno() != null && !dto.getSno().isBlank() ? dto.getSno() : String.valueOf(idx));
            student.setRegNo(regNo);
            student.setName(dto.getName() != null ? dto.getName().trim() : "Student " + idx);
            student.setDept(dto.getDept() != null ? dto.getDept().trim().toUpperCase() : "GENERAL");
            student.setExamYear(dto.getYear() != null && dto.getYear() > 0 ? dto.getYear() : 1);
            student.setMarks(dto.getMarks());
            students.add(student);
            idx++;
        }
        List<Student> saved = studentService.saveAll(students);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Successfully saved " + saved.size() + " student records.",
                "count", saved.size(),
                "students", saved
        ));
    }

    /**
     * Sync/upsert students from the allocation result.
     * Called automatically after export to keep the database up to date.
     */
    @PostMapping("/sync")
    public ResponseEntity<?> syncStudents(@RequestBody List<Map<String, Object>> payload) {
        try {
            List<Student> synced = studentService.syncStudents(payload);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Synced " + synced.size() + " students to database.",
                "count", synced.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping
    public List<Student> getAllStudents() {
        return studentService.getAll();
    }

    @DeleteMapping
    public void deleteAll() {
        studentService.deleteAll();
    }
}
