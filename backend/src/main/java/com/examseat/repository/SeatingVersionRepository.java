package com.examseat.repository;

import com.examseat.model.SeatingVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SeatingVersionRepository extends JpaRepository<SeatingVersion, Long> {
    List<SeatingVersion> findByGenerationIdOrderByVersionDesc(String generationId);
    Optional<SeatingVersion> findFirstByGenerationIdOrderByVersionDesc(String generationId);
    List<SeatingVersion> findByStatus(String status);
}
