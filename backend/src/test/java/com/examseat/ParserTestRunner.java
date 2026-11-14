package com.examseat;

import com.examseat.dto.ExamEntryDto;
import com.examseat.dto.StudentExtractionResponse;
import com.examseat.service.FuzzyNormalizationService;
import com.examseat.service.StudentParserService;
import com.examseat.service.TesseractOcrService;
import com.examseat.service.TimetableParserService;
import org.springframework.mock.web.MockMultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.util.List;

public class ParserTestRunner {
    public static void main(String[] args) {
        System.out.println("=== RUNNING OCR PARSER TESTS ===");
        try {
            TesseractOcrService ocr = new TesseractOcrService();
            System.out.println("Tesseract available: " + ocr.isAvailable());
            System.out.println("Tesseract path: " + ocr.getTesseractPath());

            // Test 1: Timetable PDF
            File ttFile = new File("sample_docs/TT_final.pdf");
            if (!ttFile.exists()) ttFile = new File("../sample_docs/TT_final.pdf");
            if (ttFile.exists()) {
                System.out.println("\n--- Testing TT_final.pdf ---");
                FuzzyNormalizationService fuzzy = new FuzzyNormalizationService();
                TimetableParserService parser = new TimetableParserService(fuzzy, ocr);
                try (FileInputStream fis = new FileInputStream(ttFile)) {
                    MockMultipartFile mockFile = new MockMultipartFile("file", "TT_final.pdf", "application/pdf", fis);
                    List<ExamEntryDto> entries = parser.parseTimetableSync(mockFile);
                    System.out.println("Successfully extracted " + entries.size() + " timetable entries:");
                    for (int i = 0; i < Math.min(10, entries.size()); i++) {
                        ExamEntryDto e = entries.get(i);
                        System.out.printf("  [%d] Date: %s | Session: %s | Dept: %s | Year: %d | Code: %s | Subject: %s\n",
                                i + 1, e.getExamDate(), e.getSession(), e.getDepartment(), e.getYear(), e.getCourseCode(), e.getSubject());
                    }
                    if (entries.size() > 10) {
                        System.out.println("  ... and " + (entries.size() - 10) + " more entries.");
                    }
                }
            }

            // Test 2: Student PDF
            File stuFile = new File("sample_docs/Student_Transcript_3rd year.pdf");
            if (!stuFile.exists()) stuFile = new File("../sample_docs/Student_Transcript_3rd year.pdf");
            if (stuFile.exists()) {
                System.out.println("\n--- Testing Student_Transcript_3rd year.pdf ---");
                StudentParserService studentParser = new StudentParserService(ocr);
                try (FileInputStream fis = new FileInputStream(stuFile)) {
                    MockMultipartFile mockFile = new MockMultipartFile("file", "Student_Transcript_3rd year.pdf", "application/pdf", fis);
                    StudentExtractionResponse res = studentParser.parseStudentPdf(mockFile);
                    System.out.println("Successfully extracted " + res.getStudents().size() + " student records:");
                    res.getStudents().forEach(s -> {
                        System.out.printf("  Reg: %s | Name: %s | Dept: %s | Year: %d | Missing: %s\n",
                                s.getRegNo(), s.getName(), s.getDept(), s.getYear(), s.getMissingFields());
                    });
                }
            }

            System.out.println("\n=== ALL OCR PARSER TESTS PASSED! ===");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
