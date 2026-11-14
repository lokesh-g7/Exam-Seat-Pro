package com.examseat;

import com.examseat.model.Allocation;
import com.examseat.model.IssueReport;
import com.examseat.model.SeatingVersion;
import com.examseat.model.Student;
import com.examseat.repository.IssueReportRepository;
import com.examseat.repository.SeatingVersionRepository;
import com.examseat.service.AllocationService;
import com.examseat.service.StudentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class SyncAndIssueIntegrationTest {

    @Autowired
    private IssueReportRepository issueReportRepository;

    @Autowired
    private StudentService studentService;

    @Autowired
    private AllocationService allocationService;

    @Autowired
    private SeatingVersionRepository seatingVersionRepository;

    @Test
    public void testIssueReportTableAndSave() {
        // Test Issue Submission matching Image 1
        IssueReport report = new IssueReport();
        report.setRegNo("2117240080068");
        report.setStudentName("LOKESH G");
        report.setDept("CSBS");
        report.setYear(3);
        report.setCategory("Timetable / Subject Code Conflict");
        report.setMessage("ESS exam in FN not in AN");

        IssueReport saved = issueReportRepository.save(report);
        assertNotNull(saved.getId(), "IssueReport should be persisted with generated ID");
        assertEquals("OPEN", saved.getStatus());
        assertEquals(3, saved.getYear());

        List<IssueReport> reports = issueReportRepository.findAll();
        assertFalse(reports.isEmpty(), "Should find saved issue reports in database");
        System.out.println("✅ ISSUE_REPORTS Table verified: Saved issue #" + saved.getId() + " for " + saved.getStudentName());
    }

    @Test
    public void testStudentSyncWithYearAndDeduplication() {
        // Test student upload payload with year field and duplicate regNos matching Image 2
        List<Student> students = new ArrayList<>();
        
        Student s1 = new Student();
        s1.setRegNo("2117240080068");
        s1.setName("LOKESH G");
        s1.setDept("CSBS");
        s1.setYear(3);
        s1.setMarks(88.5);
        students.add(s1);

        // Duplicate entry (e.g. repeated in flat array or re-uploaded)
        Student s1Dup = new Student();
        s1Dup.setRegNo("2117240080068");
        s1Dup.setName("LOKESH G");
        s1Dup.setDept("CSBS");
        s1Dup.setYear(3);
        students.add(s1Dup);

        Student s2 = new Student();
        s2.setRegNo("2117240080069");
        s2.setName("RAMESH K");
        s2.setDept("CSE");
        s2.setYear(2);
        students.add(s2);

        List<Student> saved = studentService.saveAll(students);
        assertEquals(2, saved.size(), "Deduplication should keep 2 unique students");

        Optional<Student> found = studentService.findByRegNo("2117240080068");
        assertTrue(found.isPresent(), "Student 2117240080068 should be found");
        assertEquals(3, found.get().getExamYear(), "ExamYear should be 3");
        assertEquals(3, found.get().getYear(), "Year alias should be 3");
        System.out.println("✅ Student Sync verified: Saved " + saved.size() + " students with proper examYear mapping");
    }

    @Test
    public void testAllocationSaveAndStudentPortalLookup() {
        // Test Allocation save and Student Dashboard query matching Image 3
        List<Allocation> allocs = new ArrayList<>();

        Allocation a1 = new Allocation();
        a1.setRegNo("2117240080068");
        a1.setName("LOKESH G");
        a1.setDept("CSBS");
        a1.setExamYear(3);
        a1.setHall(1);
        a1.setHallName("Exam Hall 101");
        a1.setSeat(5);
        a1.setSeatRow(2);
        a1.setSeatCol(3);
        a1.setCourseCode("CS8501");
        a1.setSubject("Environmental Science and Sustainability");
        a1.setExamDate("2026-11-20");
        a1.setSession("FN");
        a1.setExamMode("SEMESTER");
        allocs.add(a1);

        List<Allocation> saved = allocationService.saveAllocations(allocs);
        assertEquals(1, saved.size());

        // Verify Student Portal can retrieve this allocation
        Optional<Allocation> studentSeat = allocationService.findByRegNo("2117240080068");
        assertTrue(studentSeat.isPresent(), "Student Portal should find allocation for 2117240080068");
        assertEquals("Exam Hall 101", studentSeat.get().getHallName());
        assertEquals(5, studentSeat.get().getSeat());
        assertEquals(2, studentSeat.get().getSeatRow());
        assertEquals(3, studentSeat.get().getSeatCol());

        // Verify Published SeatingVersion was automatically generated
        List<SeatingVersion> published = seatingVersionRepository.findByStatus("PUBLISHED");
        assertFalse(published.isEmpty(), "Published seating version should be recorded");
        System.out.println("✅ Allocation & Student Portal verified: Seat " + studentSeat.get().getSeat() + " in " + studentSeat.get().getHallName() + " published successfully");
    }
}

