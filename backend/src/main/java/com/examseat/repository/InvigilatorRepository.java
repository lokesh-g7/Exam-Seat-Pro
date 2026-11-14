package com.examseat.repository;

import com.examseat.model.Invigilator;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InvigilatorRepository extends JpaRepository<Invigilator, Long> {
    List<Invigilator> findByDepartmentCode(String departmentCode);
    List<Invigilator> findByAvailabilityStatus(String availabilityStatus);
}
