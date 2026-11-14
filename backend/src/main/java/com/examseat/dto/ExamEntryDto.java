package com.examseat.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamEntryDto {
    
    private Long id;
    private String department;
    private Integer year;
    private String courseCode;
    private String subject;
    private LocalDate examDate;
    private String session;
    
    @Builder.Default
    private Double confidenceScore = 1.0;
    
    @Builder.Default
    private Map<String, Double> fieldConfidences = new HashMap<>();
    
    @Builder.Default
    @JsonProperty("requiresReview")
    private boolean requiresReview = false;

    private String rawValue;
    private String normalizedValue;
    private String extractionMethod; // e.g. "DIRECT_TEXT", "TABULA_TABLE", "OCR_FALLBACK"
    private String validationStatus; // e.g. "GREEN", "YELLOW", "RED"
    
    public boolean hasLowConfidence() {
        return confidenceScore < 0.8 || (fieldConfidences != null && fieldConfidences.values().stream()
                .anyMatch(c -> c != null && c < 0.8));
    }
}