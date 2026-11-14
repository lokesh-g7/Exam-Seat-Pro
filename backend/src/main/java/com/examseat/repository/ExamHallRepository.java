package com.examseat.repository;

import com.examseat.model.ExamHall;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ExamHallRepository extends JpaRepository<ExamHall, Long> {
    Optional<ExamHall> findByHallName(String hallName);
}
