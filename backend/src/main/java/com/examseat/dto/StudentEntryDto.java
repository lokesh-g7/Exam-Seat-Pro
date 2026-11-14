package com.examseat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentEntryDto {
    private String sno;
    private String regNo;
    private String name;
    private String dept;
    private Integer year;
    private Double marks;

    @Builder.Default
    private List<String> missingFields = new ArrayList<>();

    private boolean requiresReview;
    private double confidenceScore;
    private String extractionMethod; // e.g. OCR_TESSERACT, DIRECT_TEXT, CSV
}

