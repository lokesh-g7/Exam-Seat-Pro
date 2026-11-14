package com.examseat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "semesters")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Semester {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer semesterNumber; // e.g., 1, 2, 3, 4, 5, 6, 7, 8

    private String academicYear; // e.g., "2025-26"

    private String regulation; // e.g., "2021"

    private String departmentCode; // e.g., "CSE"
}
