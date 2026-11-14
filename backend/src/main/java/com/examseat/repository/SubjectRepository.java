package com.examseat.repository;

import com.examseat.model.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SubjectRepository extends JpaRepository<Subject, Long> {
    Optional<Subject> findBySubjectCode(String subjectCode);
    List<Subject> findByDepartmentCode(String departmentCode);
    List<Subject> findByDepartmentCodeAndSemester(String departmentCode, Integer semester);
}
