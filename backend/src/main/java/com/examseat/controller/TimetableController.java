package com.examseat.controller;

import com.examseat.dto.ExamEntryDto;
import com.examseat.model.ExamTimetable;
import com.examseat.repository.ExamTimetableRepository;
import com.examseat.repository.AllocationRepository;
import com.examseat.service.TimetableParserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/timetable")
@CrossOrigin(origins = "*")
public class TimetableController {

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    @Autowired
    private TimetableParserService parserService;

    @Autowired
    private ExamTimetableRepository repository;

    @Autowired
    private AllocationRepository allocationRepository;

    @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> extractTimetable(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("No file provided"));
        }

        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean isPdf = (contentType != null && contentType.equals("application/pdf"))
                || (filename != null && filename.toLowerCase().endsWith(".pdf"));

        if (!isPdf) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("Only PDF files are allowed"));
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("File size exceeds 10MB limit"));
        }

        try {
            List<ExamEntryDto> entries = parserService.parseTimetableSync(file);
            
            boolean requiresReview = entries.stream().anyMatch(ExamEntryDto::isRequiresReview);
            
            ExtractionResponse response = new ExtractionResponse();
            response.setEntries(entries);
            response.setTotalEntries(entries.size());
            response.setRequiresReview(requiresReview);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to parse PDF: " + e.getMessage()));
        }
    }

    @PostMapping("/confirm")
    public ResponseEntity<?> confirmTimetable(@RequestBody List<ExamEntryDto> entries) {
        if (entries == null || entries.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("No entries provided"));
        }

        List<String> errors = validateEntries(entries);
        if (!errors.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ValidationErrorResponse(errors));
        }

        List<ExamTimetable> savedEntries = new ArrayList<>();
        
        for (ExamEntryDto dto : entries) {
            String department = parserService.stripSectionSuffix(dto.getDepartment());
            
            ExamTimetable existing = null;
            List<ExamTimetable> byDeptYear = repository.findByDepartmentAndYear(department, dto.getYear());
            for (ExamTimetable t : byDeptYear) {
                if (t.getCourseCode().equals(dto.getCourseCode()) && 
                    t.getExamDate().equals(dto.getExamDate())) {
                    existing = t;
                    break;
                }
            }

            if (existing != null) {
                existing.setSubject(dto.getSubject());
                existing.setSession(dto.getSession());
                savedEntries.add(repository.save(existing));
            } else {
                ExamTimetable entry = new ExamTimetable();
                entry.setDepartment(department);
                entry.setYear(dto.getYear());
                entry.setCourseCode(dto.getCourseCode());
                entry.setSubject(dto.getSubject());
                entry.setExamDate(dto.getExamDate());
                entry.setSession(dto.getSession());
                savedEntries.add(repository.save(entry));
            }
        }

        return ResponseEntity.ok(savedEntries);
    }

    @PostMapping("/upload")
    public ResponseEntity<List<ExamTimetable>> uploadPdf(@RequestParam("file") MultipartFile file) {
        try {
            List<ExamEntryDto> parsed = parserService.parseTimetableSync(file);
            
            List<ExamTimetable> entries = new ArrayList<>();
            for (ExamEntryDto dto : parsed) {
                String department = parserService.stripSectionSuffix(dto.getDepartment());
                ExamTimetable entry = new ExamTimetable();
                entry.setDepartment(department);
                entry.setYear(dto.getYear());
                entry.setCourseCode(dto.getCourseCode());
                entry.setSubject(dto.getSubject());
                entry.setExamDate(dto.getExamDate());
                entry.setSession(dto.getSession());
                entries.add(entry);
            }
            
            return ResponseEntity.ok(entries);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/save-all")
    public ResponseEntity<List<ExamTimetable>> saveAll(@RequestBody List<ExamTimetable> entries) {
        List<ExamTimetable> saved = repository.saveAll(entries);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<ExamTimetable>> getAll() {
        return ResponseEntity.ok(repository.findAll());
    }

    @PostMapping
    public ResponseEntity<ExamTimetable> save(@RequestBody ExamTimetable entry) {
        String department = parserService.stripSectionSuffix(entry.getDepartment());
        entry.setDepartment(department);
        return ResponseEntity.ok(repository.save(entry));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        repository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/departments")
    public ResponseEntity<List<String>> getDistinctDepartments() {
        List<ExamTimetable> all = repository.findAll();
        List<String> departments = all.stream()
                .map(t -> parserService.stripSectionSuffix(t.getDepartment()))
                .distinct()
                .sorted()
                .collect(Collectors.toList());
        return ResponseEntity.ok(departments);
    }

    /**
     * Get timetable for a student by their department and year.
     * Used in student portal to show upcoming exams.
     */
    @GetMapping("/student/{dept}/{year}")
    public ResponseEntity<List<ExamTimetable>> getStudentTimetable(
            @PathVariable String dept,
            @PathVariable Integer year) {
        String cleanDept = parserService.stripSectionSuffix(dept);
        List<ExamTimetable> entries = repository.findByDepartmentAndYearOrderByExamDateAsc(cleanDept, year);
        if (entries.isEmpty()) {
            // Try case-insensitive fallback
            entries = repository.findAll().stream()
                    .filter(t -> parserService.stripSectionSuffix(t.getDepartment())
                            .equalsIgnoreCase(cleanDept) && year.equals(t.getYear()))
                    .sorted(java.util.Comparator.comparing(ExamTimetable::getExamDate))
                    .collect(Collectors.toList());
        }
        return ResponseEntity.ok(entries);
    }

    private List<String> validateEntries(List<ExamEntryDto> entries) {
        List<String> errors = new ArrayList<>();
        
        for (int i = 0; i < entries.size(); i++) {
            ExamEntryDto entry = entries.get(i);
            
            if (entry.getDepartment() == null || entry.getDepartment().trim().isEmpty()) {
                errors.add("Entry " + (i + 1) + ": Department is required");
            }
            
            if (entry.getYear() == null || entry.getYear() < 1 || entry.getYear() > 4) {
                errors.add("Entry " + (i + 1) + ": Year must be between 1 and 4");
            }
            
            if (entry.getCourseCode() == null || entry.getCourseCode().trim().isEmpty()) {
                errors.add("Entry " + (i + 1) + ": Course code is required");
            }
            
            if (entry.getExamDate() == null) {
                errors.add("Entry " + (i + 1) + ": Exam date is required");
            }
            
            if (entry.getSession() == null || (!entry.getSession().equals("FN") && !entry.getSession().equals("AN"))) {
                errors.add("Entry " + (i + 1) + ": Session must be FN or AN");
            }
        }
        
        return errors;
    }

    public static class ErrorResponse {
        private String error;
        
        public ErrorResponse() {}
        
        public ErrorResponse(String error) {
            this.error = error;
        }
        
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
    }

    @PostMapping("/impact-analysis")
    public ResponseEntity<?> getImpactAnalysis(@RequestBody ExamTimetable draft) {
        if (draft == null || draft.getDepartment() == null || draft.getYear() == null) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Department and year are required"));
        }

        String targetDept = parserService.stripSectionSuffix(draft.getDepartment());
        Integer targetYear = draft.getYear();

        // Fetch all current allocations
        List<com.examseat.model.Allocation> allAllocations = allocationRepository.findAll();

        // Determine affected students
        List<com.examseat.model.Allocation> affectedStudents = allAllocations.stream()
                .filter(alloc -> {
                    String cleanDept = parserService.stripSectionSuffix(alloc.getDept());
                    return cleanDept.equalsIgnoreCase(targetDept) && targetYear.equals(alloc.getExamYear());
                })
                .collect(Collectors.toList());

        // Determine affected halls
        List<Integer> affectedHalls = affectedStudents.stream()
                .map(com.examseat.model.Allocation::getHall)
                .distinct()
                .sorted()
                .collect(Collectors.toList());

        // Determine affected exams: any timetable entries for the same dept and year, or same date/session
        List<ExamTimetable> allTimetable = repository.findAll();
        List<String> affectedExams = allTimetable.stream()
                .filter(t -> {
                    String cleanTDept = parserService.stripSectionSuffix(t.getDepartment());
                    boolean sameGroup = cleanTDept.equalsIgnoreCase(targetDept) && targetYear.equals(t.getYear());
                    boolean sameSession = t.getExamDate() != null && t.getExamDate().equals(draft.getExamDate()) 
                                          && t.getSession() != null && t.getSession().equalsIgnoreCase(draft.getSession());
                    return sameGroup || sameSession;
                })
                .map(t -> t.getCourseCode() + " - " + t.getSubject())
                .distinct()
                .collect(Collectors.toList());

        int unaffectedAllocationsCount = allAllocations.size() - affectedStudents.size();

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("affectedStudentsCount", affectedStudents.size());
        result.put("affectedHalls", affectedHalls);
        result.put("affectedExams", affectedExams);
        result.put("unaffectedAllocationsCount", unaffectedAllocationsCount);

        return ResponseEntity.ok(result);
    }

    public static class ValidationErrorResponse {
        private List<String> errors;
        
        public ValidationErrorResponse() {}
        
        public ValidationErrorResponse(List<String> errors) {
            this.errors = errors;
        }
        
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
    }

    public static class ExtractionResponse {
        private List<ExamEntryDto> entries;
        private int totalEntries;
        private boolean requiresReview;
        
        public List<ExamEntryDto> getEntries() { return entries; }
        public void setEntries(List<ExamEntryDto> entries) { this.entries = entries; }
        public int getTotalEntries() { return totalEntries; }
        public void setTotalEntries(int totalEntries) { this.totalEntries = totalEntries; }
        public boolean isRequiresReview() { return requiresReview; }
        public void setRequiresReview(boolean requiresReview) { this.requiresReview = requiresReview; }
    }
}
