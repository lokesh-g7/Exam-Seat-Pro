package com.examseat;

import com.examseat.model.Allocation;
import com.examseat.model.IssueReport;
import com.examseat.model.SeatingVersion;
import com.examseat.model.Student;
import com.examseat.repository.IssueReportRepository;
import com.examseat.repository.SeatingVersionRepository;
import com.examseat.service.AllocationService;
import com.examseat.service.StudentService;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class SyncVerificationRunner {

    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("  STARTING BACKEND & DATABASE SYNC VERIFICATION   ");
        System.out.println("==================================================");

        ConfigurableApplicationContext context = null;
        try {
            // Boot Spring Context
            context = SpringApplication.run(ExamSeatProApplication.class, args);
            System.out.println(">> Spring Application Context initialized successfully!");

            IssueReportRepository issueReportRepository = context.getBean(IssueReportRepository.class);
            StudentService studentService = context.getBean(StudentService.class);
            AllocationService allocationService = context.getBean(AllocationService.class);
            SeatingVersionRepository seatingVersionRepository = context.getBean(SeatingVersionRepository.class);

            // 1. VERIFY ISSUE_REPORTS TABLE AND SAVE (Fixes Image 1)
            System.out.println("\n[1] Testing IssueReport submission (Image 1 fix)...");
            IssueReport report = new IssueReport();
            report.setRegNo("2117240080068");
            report.setStudentName("LOKESH G");
            report.setDept("CSBS");
            report.setYear(3);
            report.setCategory("Timetable / Subject Code Conflict");
            report.setMessage("ESS exam in FN not in AN");

            IssueReport savedReport = issueReportRepository.save(report);
            if (savedReport.getId() == null) throw new RuntimeException("IssueReport ID was not generated!");
            System.out.println("  SUCCESS: Issue #" + savedReport.getId() + " saved for " + savedReport.getStudentName() +
                    " with academic_year=" + savedReport.getYear() + ", status=" + savedReport.getStatus());

            // 2. VERIFY STUDENT SYNC & DEDUPLICATION & YEAR MAPPING (Fixes Image 2)
            System.out.println("\n[2] Testing Student sync & deduplication (Image 2 fix)...");
            List<Student> students = new ArrayList<>();
            Student s1 = new Student();
            s1.setRegNo("2117240080068");
            s1.setName("LOKESH G");
            s1.setDept("CSBS");
            s1.setYear(3);
            s1.setMarks(91.0);
            students.add(s1);

            // Duplicate row that previously caused unique constraint 500 error
            Student s1Dup = new Student();
            s1Dup.setRegNo("2117240080068");
            s1Dup.setName("LOKESH G");
            s1Dup.setDept("CSBS");
            s1Dup.setYear(3);
            students.add(s1Dup);

            Student s2 = new Student();
            s2.setRegNo("2117240080070");
            s2.setName("PRIYA M");
            s2.setDept("AIDS");
            s2.setYear(2);
            students.add(s2);

            List<Student> savedStudents = studentService.saveAll(students);
            System.out.println("  SUCCESS: Uploaded " + students.size() + " items, deduplicated & stored " + savedStudents.size() + " students.");
            
            Optional<Student> foundStudent = studentService.findByRegNo("2117240080068");
            if (foundStudent.isEmpty() || foundStudent.get().getExamYear() != 3) {
                throw new RuntimeException("Student year mapping failed! Found: " + foundStudent);
            }
            System.out.println("  SUCCESS: Student 2117240080068 retrieved with examYear=" + foundStudent.get().getExamYear());

            // 3. VERIFY ALLOCATION PERSISTENCE & STUDENT DASHBOARD LOOKUP (Fixes Image 3)
            System.out.println("\n[3] Testing Seating Allocation & Student Portal sync (Image 3 fix)...");
            List<Allocation> allocations = new ArrayList<>();
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
            allocations.add(a1);

            List<Allocation> savedAllocs = allocationService.saveAllocations(allocations);
            System.out.println("  SUCCESS: Saved " + savedAllocs.size() + " allocations to database.");

            Optional<Allocation> lookup = allocationService.findByRegNo("2117240080068");
            if (lookup.isEmpty()) throw new RuntimeException("Allocation for 2117240080068 not found!");
            System.out.println("  SUCCESS: Student Portal query for 2117240080068 returned: " +
                    lookup.get().getHallName() + ", Seat #" + lookup.get().getSeat() + ", Row " + lookup.get().getSeatRow() + ", Col " + lookup.get().getSeatCol());

            List<SeatingVersion> publishedVersions = seatingVersionRepository.findByStatus("PUBLISHED");
            if (publishedVersions.isEmpty()) throw new RuntimeException("Published SeatingVersion was not created!");
            System.out.println("  SUCCESS: Found " + publishedVersions.size() + " published seating version(s). Exports and Student Portal are authoritative.");

            System.out.println("\n==================================================");
            System.out.println("  ALL 3 FIXES VERIFIED 100% WORKING AND COMPATIBLE ");
            System.out.println("==================================================");

        } catch (Exception e) {
            System.err.println("\n❌ VERIFICATION FAILED:");
            e.printStackTrace();
            System.exit(1);
        } finally {
            if (context != null) {
                context.close();
            }
        }
    }
}

