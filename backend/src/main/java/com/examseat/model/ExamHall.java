package com.examseat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "exam_halls")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamHall {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String hallName; // e.g., "LH-101", "Lab-2"

    @Column(nullable = false)
    private Integer rowsCount; // e.g., 8

    @Column(nullable = false)
    private Integer columnsCount; // e.g., 4 or 8

    @Column(nullable = false)
    private Integer seatsPerTable = 1; // 1 or 2 students per bench

    @Lob
    private String blockedSeats; // comma-separated coordinates, e.g. "0-2,1-3" (row-col index starting at 0)

    @Lob
    private String accessibilitySeats; // e.g. front row coords

    @Lob
    private String reservedSeats; // reserved seat coordinates

    private String allowedExamTypes; // comma-separated, e.g. "Internal Examination,University Examination"

    private String seatingModes; // comma-separated, e.g. "semester,internal"

    private boolean active = true;
}
