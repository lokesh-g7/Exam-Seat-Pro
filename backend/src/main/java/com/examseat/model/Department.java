package com.examseat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "departments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String departmentCode; // e.g., "CSE", "ECE"

    @Column(nullable = false)
    private String departmentName; // e.g., "Computer Science and Engineering"

    private String program; // e.g., "B.E.", "B.Tech"

    private String regulations; // e.g., "2021"

    private boolean active = true;
}
