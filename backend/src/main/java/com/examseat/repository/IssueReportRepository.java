package com.examseat.repository;

import com.examseat.model.IssueReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IssueReportRepository extends JpaRepository<IssueReport, Long> {

    List<IssueReport> findAllByOrderByCreatedAtDesc();

    List<IssueReport> findByRegNoOrderByCreatedAtDesc(String regNo);

    long countByStatus(String status);
}

