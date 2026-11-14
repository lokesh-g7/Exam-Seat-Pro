package com.examseat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "subjects")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Subject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String subjectCode; // e.g., "CS2303"

    @Column(nullable = false)
    private String subjectName; // e.g., "Database Management Systems"

    private String departmentCode; // e.g., "CSE"

    private Integer semester; // e.g., 3

    private String regulation; // e.g., "2021"

    private String examType; // e.g., "University Examination"

    private boolean active = true;
}
