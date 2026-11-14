package com.examseat.repository;

import com.examseat.model.Allocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AllocationRepository extends JpaRepository<Allocation, Long> {
    Optional<Allocation> findByRegNo(String regNo);
    Optional<Allocation> findByRegNoIgnoreCase(String regNo);
}
