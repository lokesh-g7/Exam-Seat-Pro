package com.examseat.repository;

import com.examseat.model.Semester;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SemesterRepository extends JpaRepository<Semester, Long> {
    List<Semester> findByDepartmentCode(String departmentCode);
    Optional<Semester> findByDepartmentCodeAndSemesterNumber(String departmentCode, Integer semesterNumber);
}
