package com.examseat.service;

import com.examseat.model.Student;
import com.examseat.repository.StudentRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class StudentService {

    @Autowired
    private StudentRepository studentRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public List<Student> saveAll(List<Student> students) {
        if (students == null || students.isEmpty()) {
            return Collections.emptyList();
        }

        // Deduplicate by regNo to prevent unique constraint violation
        Map<String, Student> uniqueStudents = new LinkedHashMap<>();
        int fallbackIndex = 1;
        for (Student s : students) {
            if (s == null) continue;
            String reg = s.getRegNo();
            if (reg == null || reg.isBlank()) {
                reg = "STU_" + System.currentTimeMillis() + "_" + (fallbackIndex++);
                s.setRegNo(reg);
            } else {
                reg = reg.trim();
                s.setRegNo(reg);
            }
            if (s.getName() == null || s.getName().isBlank()) {
                s.setName("Student " + (s.getSno() != null ? s.getSno() : fallbackIndex));
            }
            if (s.getDept() == null || s.getDept().isBlank()) {
                s.setDept("GENERAL");
            }
            if (s.getExamYear() == null) {
                s.setExamYear(1);
            }
            // Clear existing id so fresh entities are inserted cleanly
            s.setId(null);
            uniqueStudents.put(reg.toUpperCase(), s);
        }

        // Clear existing records and flush immediately so DELETE precedes INSERT
        studentRepository.deleteAll();
        entityManager.flush();
        entityManager.clear();

        return studentRepository.saveAll(uniqueStudents.values());
    }

    /**
     * Sync / upsert students from the allocation result.
     * Updates existing records by regNo, inserts new ones.
     */
    @Transactional
    public List<Student> syncStudents(List<Map<String, Object>> payload) {
        if (payload == null) return Collections.emptyList();

        for (Map<String, Object> item : payload) {
            if (item == null) continue;
            Object rawReg = item.get("regNo");
            if (rawReg == null || rawReg.toString().isBlank()) continue;
            String regNo = rawReg.toString().trim();

            Student student = studentRepository.findByRegNo(regNo)
                    .orElseGet(() -> studentRepository.findByRegNoIgnoreCase(regNo).orElse(new Student()));
            student.setRegNo(regNo);
            if (item.get("sno") != null) student.setSno(String.valueOf(item.get("sno")));
            if (item.get("name") != null) student.setName(String.valueOf(item.get("name")).trim());
            if (item.get("dept") != null) student.setDept(String.valueOf(item.get("dept")).trim());
            
            Object yearObj = item.get("examYear") != null ? item.get("examYear") : item.get("year");
            if (yearObj instanceof Number) {
                student.setExamYear(((Number) yearObj).intValue());
            } else if (yearObj instanceof String && !((String) yearObj).isBlank()) {
                try {
                    student.setExamYear(Integer.parseInt(((String) yearObj).replaceAll("[^0-9]", "")));
                } catch (NumberFormatException ignored) {}
            }
            
            if (item.get("marks") instanceof Number) {
                student.setMarks(((Number) item.get("marks")).doubleValue());
            }
            studentRepository.save(student);
        }
        entityManager.flush();
        return studentRepository.findAll();
    }

    public List<Student> getAll() {
        return studentRepository.findAll();
    }

    public Optional<Student> findByRegNo(String regNo) {
        if (regNo == null) return Optional.empty();
        String trimmed = regNo.trim();
        Optional<Student> direct = studentRepository.findByRegNo(trimmed);
        if (direct.isPresent()) return direct;
        return studentRepository.findByRegNoIgnoreCase(trimmed);
    }

    @Transactional
    public void deleteAll() {
        studentRepository.deleteAll();
        entityManager.flush();
        entityManager.clear();
    }
}
