package com.examseat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentExtractionResponse {
    @Builder.Default
    private List<StudentEntryDto> students = new ArrayList<>();
    private int totalCount;
    private boolean hasMissingFields;
    private int missingCount;
    private String extractionMethod;
    private String message;
    
    @Builder.Default
    private Map<String, Integer> missingSummary = new HashMap<>();
}

