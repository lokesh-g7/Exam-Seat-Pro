package com.examseat.config;

import com.examseat.model.*;
import com.examseat.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Arrays;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private SemesterRepository semesterRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private ExamHallRepository examHallRepository;

    @Autowired
    private InvigilatorRepository invigilatorRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @org.springframework.beans.factory.annotation.Value("${admin.initial.password:admin123}")
    private String adminInitialPassword;

    @Override
    public void run(String... args) {
        // 1. Create default admin if not exists
        if (userRepository.findByUsername("admin") == null) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(passwordEncoder.encode(adminInitialPassword));
            admin.setRole("ADMIN");
            admin.setName("Administrator");
            userRepository.save(admin);
            System.out.println("Default admin user initialized with secure password.");
        }

        // 2. Prepopulate Departments
        if (departmentRepository.count() == 0) {
            departmentRepository.saveAll(Arrays.asList(
                new Department(null, "CSE", "Computer Science and Engineering", "B.E.", "2021", true),
                new Department(null, "ECE", "Electronics and Communication", "B.E.", "2021", true),
                new Department(null, "EEE", "Electrical and Electronics", "B.E.", "2021", true),
                new Department(null, "IT", "Information Technology", "B.Tech", "2021", true),
                new Department(null, "CCE", "Computer and Communication", "B.E.", "2021", true)
            ));
            System.out.println("Prepopulated default departments.");
        }

        // 3. Prepopulate Semesters
        if (semesterRepository.count() == 0) {
            semesterRepository.saveAll(Arrays.asList(
                new Semester(null, 1, "2025-26", "2021", "CSE"),
                new Semester(null, 3, "2025-26", "2021", "CSE"),
                new Semester(null, 5, "2025-26", "2021", "CSE"),
                new Semester(null, 3, "2025-26", "2021", "ECE"),
                new Semester(null, 5, "2025-26", "2021", "ECE")
            ));
            System.out.println("Prepopulated default semesters.");
        }

        // 4. Prepopulate Subjects
        if (subjectRepository.count() == 0) {
            subjectRepository.saveAll(Arrays.asList(
                new Subject(null, "CS3001", "Artificial Intelligence", "CSE", 3, "2021", "University Examination", true),
                new Subject(null, "CS3002", "Database Management Systems", "CSE", 3, "2021", "University Examination", true),
                new Subject(null, "CS3003", "Computer Networks", "CSE", 3, "2021", "University Examination", true),
                new Subject(null, "EC3001", "Digital Signal Processing", "ECE", 3, "2021", "University Examination", true),
                new Subject(null, "EC3002", "Microcontrollers", "ECE", 3, "2021", "University Examination", true)
            ));
            System.out.println("Prepopulated default subjects.");
        }

        // 5. Prepopulate Exam Halls — realistic sizes for large exams
        if (examHallRepository.count() == 0) {
            examHallRepository.saveAll(Arrays.asList(
                // Hall A: Large lecture hall — 15 rows × 10 cols, individual seats (spt=1), 150 seats
                new ExamHall(null, "Hall A (Main Block)", 15, 10, 1, "", "0-0,0-1", "", "Internal Examination,University Examination", "semester,internal", true),
                // Hall B: Medium hall — 12 rows × 10 cols, individual seats, 120 seats
                new ExamHall(null, "Hall B (East Wing)", 12, 10, 1, "", "0-0,0-1", "", "Internal Examination,University Examination", "semester,internal", true),
                // Hall C: Lab hall — 10 rows × 8 cols, bench pairs (spt=2), internal mode
                new ExamHall(null, "Hall C (Lab Block)", 10, 8, 2, "", "0-0", "", "Internal Examination", "internal", true),
                // Hall D: Medium hall — 10 rows × 8 cols, individual seats, 80 seats
                new ExamHall(null, "Hall D (West Wing)", 10, 8, 1, "", "", "", "University Examination", "semester", true)
            ));
            System.out.println("Prepopulated default exam halls (large capacity).");
        }

        // 6. Prepopulate Invigilators
        if (invigilatorRepository.count() == 0) {
            invigilatorRepository.saveAll(Arrays.asList(
                new Invigilator(null, "Dr. Sarah Connor", "sarah@college.edu", "CSE", "Available", 12, "[]"),
                new Invigilator(null, "Prof. Charles Xavier", "xavier@college.edu", "ECE", "Available", 12, "[]"),
                new Invigilator(null, "Dr. Bruce Banner", "banner@college.edu", "EEE", "Available", 8, "[]")
            ));
            System.out.println("Prepopulated default invigilators.");
        }
    }
}