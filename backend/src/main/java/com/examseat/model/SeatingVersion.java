package com.examseat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "seating_versions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatingVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String generationId; // Unique ID for this generation run

    @Column(nullable = false)
    private Integer version = 1; // e.g., 1, 2, 3

    private String creator; // Username or uploader

    private Long timestamp; // Epoch millisecond timestamp

    @Column(length = 500)
    private String changeReason;

    private Long seed; // Seed used to make the generation reproducible

    private String algorithmVersion; // Version/details of the seating algorithm

    @Lob
    private String configProfileJson; // JSON configuration parameters (mode, session, constraints, weight etc.)

    private String status = "DRAFT"; // "DRAFT", "GENERATED", "VALIDATED", "REVIEW_REQUIRED", "APPROVED", "PUBLISHED", "LOCKED"

    @Lob
    private String allocationsJson; // Complete JSON string of all allocated seats to preserve version history
}
