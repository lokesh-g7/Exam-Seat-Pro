package com.examseat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "invigilators")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Invigilator {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String email;

    private String departmentCode; // e.g., "CSE"

    private String availabilityStatus = "Available"; // "Available", "Unavailable"

    private Integer maxWorkloadHours = 12; // Maximum hours or sessions permitted

    @Lob
    private String assignedSessionsJson; // e.g., '[{"date":"2026-08-19","session":"FN","hall":"LH-101"}]'
}
