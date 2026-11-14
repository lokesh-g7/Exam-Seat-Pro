package com.examseat;

import com.examseat.dto.ExamEntryDto;
import com.examseat.dto.StudentExtractionResponse;
import com.examseat.service.FuzzyNormalizationService;
import com.examseat.service.StudentParserService;
import com.examseat.service.TesseractOcrService;
import com.examseat.service.TimetableParserService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class ParserIntegrationTest {

    @Test
    public void testTesseractAvailability() {
        TesseractOcrService ocr = new TesseractOcrService();
        assertTrue(ocr.isAvailable(), "Tesseract should be available at configured path");
        assertNotNull(ocr.getTesseractPath());
        System.out.println("Tesseract path: " + ocr.getTesseractPath());
    }

    @Test
    public void testTimetableExtractionFromScannedPdf() throws Exception {
        File file = new File("C:\\Users\\LOKESH\\Downloads\\TT_final.pdf");
        if (!file.exists()) {
            System.out.println("TT_final.pdf not found, skipping test");
            return;
        }

        TesseractOcrService ocr = new TesseractOcrService();
        FuzzyNormalizationService fuzzy = new FuzzyNormalizationService();
        TimetableParserService parser = new TimetableParserService(fuzzy, ocr);

        try (FileInputStream fis = new FileInputStream(file)) {
            MockMultipartFile mockFile = new MockMultipartFile("file", "TT_final.pdf", "application/pdf", fis);
            List<ExamEntryDto> entries = parser.parseTimetableSync(mockFile);

            assertNotNull(entries);
            assertFalse(entries.isEmpty(), "Should extract entries from scanned timetable PDF");
            System.out.println("Extracted " + entries.size() + " timetable entries from TT_final.pdf:");
            for (ExamEntryDto e : entries) {
                System.out.printf("  %s | %s | Year %d | %s | %s | %s\n",
                        e.getExamDate(), e.getSession(), e.getYear(), e.getDepartment(), e.getCourseCode(), e.getSubject());
                // Verify only the required fields are set
                assertNotNull(e.getDepartment());
                assertNotNull(e.getCourseCode());
                assertNotNull(e.getExamDate());
                assertNotNull(e.getSession());
            }
        }
    }

    @Test
    public void testStudentPdfExtraction() throws Exception {
        File file = new File("C:\\Users\\LOKESH\\Downloads\\Student_Transcript_3rd year.pdf");
        if (!file.exists()) {
            System.out.println("Student_Transcript_3rd year.pdf not found, skipping test");
            return;
        }

        TesseractOcrService ocr = new TesseractOcrService();
        StudentParserService studentParser = new StudentParserService(ocr);

        try (FileInputStream fis = new FileInputStream(file)) {
            MockMultipartFile mockFile = new MockMultipartFile("file", "Student_Transcript_3rd year.pdf", "application/pdf", fis);
            StudentExtractionResponse res = studentParser.parseStudentPdf(mockFile);

            assertNotNull(res);
            assertFalse(res.getStudents().isEmpty(), "Should extract student record from PDF");
            System.out.println("Extracted " + res.getStudents().size() + " student records:");
            res.getStudents().forEach(s -> {
                System.out.printf("  Reg: %s, Name: %s, Dept: %s, Year: %d, Missing: %s\n",
                        s.getRegNo(), s.getName(), s.getDept(), s.getYear(), s.getMissingFields());
            });
        }
    }
}

