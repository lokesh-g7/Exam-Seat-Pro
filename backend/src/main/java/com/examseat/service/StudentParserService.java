package com.examseat.service;

import com.examseat.dto.StudentEntryDto;
import com.examseat.dto.StudentExtractionResponse;
import com.examseat.model.Student;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class StudentParserService {

    private static final Logger log = LoggerFactory.getLogger(StudentParserService.class);

    private final TesseractOcrService tesseractOcrService;

    private static final String[] COMMON_DEPTS = {
            "CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AIDS", "CSBS", "CCE", "AIML",
            "BME", "BT", "VLSI", "AUTO", "CHEM", "AERO", "AI&DS"
    };

    private static final Pattern REG_NO_PATTERN = Pattern.compile(
            "\\b(\\d{8,15}|24[A-Z]{2,4}\\d{2,4}|RA\\d{10,14}|[A-Z]{1,3}\\d{5,10})\\b",
            Pattern.CASE_INSENSITIVE
    );

    public StudentParserService(TesseractOcrService tesseractOcrService) {
        this.tesseractOcrService = tesseractOcrService;
    }

    /**
     * Parses a student database PDF (scanned or digital text) and extracts student records.
     * Identifies any missing fields (regNo, name, dept, year) so the admin can review & edit.
     */
    public StudentExtractionResponse parseStudentPdf(MultipartFile file) throws IOException {
        List<StudentEntryDto> students = new ArrayList<>();
        String extractionMethod = "DIRECT_TEXT";

        try (PDDocument document = PDDocument.load(file.getInputStream())) {
            int pageCount = document.getNumberOfPages();
            StringBuilder allTextBuilder = new StringBuilder();

            for (int page = 1; page <= pageCount; page++) {
                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                allTextBuilder.append(stripper.getText(document)).append("\n");
            }

            String allText = allTextBuilder.toString().trim();

            if (allText.length() > 50) {
                students = parseStudentText(allText, "PDF_TEXT");
            }

            // If selectable text found 0 records, invoke Tesseract OCR
            if (students.isEmpty() && tesseractOcrService.isAvailable()) {
                extractionMethod = "OCR_TESSERACT";
                log.info("PDF has no selectable text. Invoking Tesseract OCR for student records extraction...");
                List<String> ocrPages = tesseractOcrService.extractTextByPages(document, 300, 6);
                StringBuilder ocrTextBuilder = new StringBuilder();
                for (String pageText : ocrPages) {
                    ocrTextBuilder.append(pageText).append("\n");
                }
                students = parseStudentText(ocrTextBuilder.toString(), "OCR_TESSERACT");

                // Try PSM 3 if PSM 6 yielded nothing
                if (students.isEmpty()) {
                    ocrPages = tesseractOcrService.extractTextByPages(document, 300, 3);
                    ocrTextBuilder = new StringBuilder();
                    for (String pageText : ocrPages) {
                        ocrTextBuilder.append(pageText).append("\n");
                    }
                    students = parseStudentText(ocrTextBuilder.toString(), "OCR_TESSERACT");
                }
            }
        } catch (Exception e) {
            log.error("Error parsing student PDF: {}", e.getMessage(), e);
        }

        return buildResponse(students, extractionMethod);
    }

    /**
     * Parses student text (from OCR or text stripper) into individual student records.
     */
    public List<StudentEntryDto> parseStudentText(String text, String method) {
        List<StudentEntryDto> list = new ArrayList<>();
        String[] lines = text.split("\\r?\\n");

        int serialCounter = 1;
        Map<String, StudentEntryDto> regMap = new LinkedHashMap<>();

        // First, check if document is a single-student document (e.g. transcript/marksheet/hall ticket)
        StudentEntryDto singleDocStudent = parseSingleStudentDoc(text, method);
        if (singleDocStudent != null && singleDocStudent.getRegNo() != null && !singleDocStudent.getRegNo().isBlank()) {
            list.add(singleDocStudent);
            return list;
        }

        // Otherwise, process line by line (table/nominal roll format)
        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.isEmpty()) continue;

            // Skip header lines
            if (looksLikeStudentHeader(line)) continue;

            StudentEntryDto entry = parseStudentLine(line, serialCounter, method);
            if (entry != null) {
                // If regNo is available, deduplicate
                String key = (entry.getRegNo() != null && !entry.getRegNo().isBlank()) 
                        ? entry.getRegNo() 
                        : "ROW_" + serialCounter;

                if (!regMap.containsKey(key)) {
                    regMap.put(key, entry);
                    serialCounter++;
                }
            }
        }

        list.addAll(regMap.values());
        return list;
    }

    private boolean looksLikeStudentHeader(String line) {
        String lower = line.toLowerCase();
        return (lower.contains("register") || lower.contains("reg. no") || lower.contains("reg no") ||
                lower.contains("roll no") || lower.contains("student name") || lower.contains("nominal roll") ||
                lower.contains("department") || lower.contains("attendance") || lower.contains("s.no") ||
                lower.contains("serial no") || lower.contains("branch")) &&
                (lower.contains("name") || lower.contains("dept") || lower.contains("year"));
    }

    /**
     * Parse a single student document (like a transcript, grade sheet, or student profile).
     */
    private StudentEntryDto parseSingleStudentDoc(String text, String method) {
        String regNo = null;
        String name = null;
        String dept = null;
        Integer year = null;
        Double marks = null;

        // ── Extract Candidate Name (multiple strategies) ─────────────────────
        // Strategy 1: "NAME OF THE CANDIDATE : LOKESH G" or similar label
        Pattern nameP1 = Pattern.compile(
            "(?i)(?:NAME\\s+OF\\s+THE\\s+CANDIDATE|CANDIDATE\\s*(?:'?S)?\\s+NAME|STUDENT\\s+NAME)[\\s:|-]+([A-Z][A-Z\\s.]{2,40})(?:\\s*(?:\\||REG|ROLL|\\d)|$)",
            Pattern.MULTILINE);
        Matcher nameM1 = nameP1.matcher(text);
        if (nameM1.find()) {
            name = nameM1.group(1).trim().replaceAll("\\s+", " ");
        }

        // Strategy 2: Look for CANDIDATE followed by name (before REGISTER)
        if (name == null || name.isBlank()) {
            Pattern nameP2 = Pattern.compile("(?i)CANDIDATE\\s+([A-Z][A-Z\\s.]{2,30})\\s+(?:REGISTER|REG\\s*NO|ROLL)");
            Matcher nameM2 = nameP2.matcher(text);
            if (nameM2.find()) {
                name = nameM2.group(1).trim().replaceAll("\\s+", " ");
            }
        }

        // Strategy 3: Scan lines for a line that is "NAME :" then capture what follows
        if (name == null || name.isBlank()) {
            for (String line : text.split("\\r?\\n")) {
                Matcher lm = Pattern.compile("(?i)^\\s*NAME\\s*[:|-]\\s*([A-Z][A-Z\\s.]{2,35})\\s*$").matcher(line.trim());
                if (lm.matches()) {
                    name = lm.group(1).trim();
                    break;
                }
            }
        }

        // Strategy 4: Find longest all-caps word sequence near register number
        if (name == null || name.isBlank()) {
            // Find position of register number in text
            Matcher rmPos = REG_NO_PATTERN.matcher(text);
            if (rmPos.find()) {
                int regStart = rmPos.start();
                // Look at 400 chars before regNo for an all-caps name block
                String vicinity = text.substring(Math.max(0, regStart - 400), regStart);
                Matcher capMatcher = Pattern.compile("([A-Z]{2}[A-Z\\s.]{5,40})").matcher(vicinity);
                String best = null;
                while (capMatcher.find()) {
                    String candidate = capMatcher.group(1).trim().replaceAll("\\s+", " ");
                    // Reject lines that look like keywords/headers
                    if (!candidate.matches("(?i).*(REGISTER|UNIVERSITY|COLLEGE|EXAM|SEMESTER|DEPARTMENT|BRANCH|COURSE|SUBJECT|MARK|GRADE|ANNA|CHENNAI|AFFILIATED|AUTONOMOUS|REGULATION|PROGRAMME|CANDIDATE).*")) {
                        if (best == null || candidate.length() > best.length()) {
                            best = candidate;
                        }
                    }
                }
                if (best != null && best.length() >= 4 && best.length() <= 45) {
                    name = best;
                }
            }
        }

        // Clean up "OF THE" prefix artefacts from OCR
        if (name != null) {
            name = name.replaceAll("(?i)^(?:OF\\s+THE|THE|CANDIDATE|NAME)\\s+", "").trim();
            name = name.replaceAll("\\s+", " ");
            if (name.length() > 45) name = name.substring(0, 45).trim();
        }

        // ── Extract Register Number ───────────────────────────────────────────
        Pattern regP = Pattern.compile("(?i)(?:REGISTER\\s*(?:NO|NUMBER)?|REG\\s*NO|ROLL\\s*NO)[:\\s|]+([A-Z0-9]{6,16})");
        Matcher regM = regP.matcher(text);
        if (regM.find()) {
            regNo = regM.group(1).trim();
        } else {
            Matcher genericRegM = REG_NO_PATTERN.matcher(text);
            if (genericRegM.find()) {
                regNo = genericRegM.group(1).trim();
            }
        }

        // ── Extract Department/Branch ─────────────────────────────────────────
        Pattern branchP = Pattern.compile("(?i)(?:BRANCH|PROGRAMME\\s*&\\s*BRANCH|DEPARTMENT)[:\\s|]+([A-Za-z\\s&]+)");
        Matcher branchM = branchP.matcher(text);
        if (branchM.find()) {
            String branchText = branchM.group(1).trim();
            dept = matchDepartment(branchText);
        }
        if (dept == null) {
            dept = matchDepartment(text);
        }

        // ── Extract Year / Semester ───────────────────────────────────────────
        Pattern yrP = Pattern.compile("(?i)(?:YEAR|SEM(?:ESTER)?|YR)[:\\s|]*(\\d{1,2}|I{1,3}V?|V?I{0,3})");
        Matcher yrM = yrP.matcher(text);
        if (yrM.find()) {
            year = parseYearOrSem(yrM.group(1));
        }
        // Infer from semester number (5,6 → year 3; 7,8 → year 4)
        if (year == null) {
            Matcher semNum = Pattern.compile("(?i)\\bSEM(?:ESTER)?\\s*(\\d)\\b").matcher(text);
            if (semNum.find()) {
                int sem = Integer.parseInt(semNum.group(1));
                year = (sem + 1) / 2;
            }
        }
        if (year == null && text.toLowerCase().contains("3rd year")) year = 3;
        if (year == null && text.toLowerCase().contains("2nd year")) year = 2;
        if (year == null && text.toLowerCase().contains("1st year")) year = 1;
        if (year == null && text.toLowerCase().contains("4th year")) year = 4;

        if (regNo != null || name != null) {
            List<String> missing = new ArrayList<>();
            if (regNo == null || regNo.isBlank()) missing.add("regNo");
            if (name == null || name.isBlank()) missing.add("name");
            if (dept == null || dept.isBlank()) missing.add("dept");
            if (year == null || year == 0) missing.add("year");

            return StudentEntryDto.builder()
                    .sno("1")
                    .regNo(regNo != null ? regNo : "")
                    .name(name != null ? name : "")
                    .dept(dept != null ? dept : "")
                    .year(year != null ? year : 1)
                    .marks(marks)
                    .missingFields(missing)
                    .requiresReview(!missing.isEmpty())
                    .confidenceScore(missing.isEmpty() ? 0.95 : 0.70)
                    .extractionMethod(method)
                    .build();
        }

        return null;
    }

    /**
     * Parses a single table row / nominal roll line into a StudentEntryDto.
     */
    private StudentEntryDto parseStudentLine(String line, int serialCounter, String method) {
        // Clean line noise
        String clean = line.replace("|", " ").replaceAll("\\s+", " ").trim();

        // 1. Check for Register Number
        Matcher regMatcher = REG_NO_PATTERN.matcher(clean);
        String regNo = "";
        if (regMatcher.find()) {
            regNo = regMatcher.group(1).trim();
        }

        // 2. Check for Department
        String dept = matchDepartment(clean);

        // 3. Check for Year
        Integer year = null;
        Matcher semMatcher = Pattern.compile("(?i)\\b(?:sem(?:ester)?)[\\s]*(\\d{1,2})\\b").matcher(clean);
        if (semMatcher.find()) {
            int sem = Integer.parseInt(semMatcher.group(1));
            year = (sem + 1) / 2;
        } else {
            Matcher yrMatcher = Pattern.compile("(?i)\\b(?:year|yr)[\\s]*([1-4])\\b").matcher(clean);
            if (yrMatcher.find()) {
                year = Integer.parseInt(yrMatcher.group(1));
            }
        }

        // 4. Check for Marks (number between 0 and 100 at the end or marked as score)
        Double marks = null;
        Matcher marksMatcher = Pattern.compile("\\b(\\d{1,3}(?:\\.\\d{1,2})?)\\s*(?:%|marks)?$").matcher(clean);
        if (marksMatcher.find()) {
            try {
                double val = Double.parseDouble(marksMatcher.group(1));
                if (val <= 100.0) marks = val;
            } catch (Exception ignored) {}
        }

        // 5. Extract Name
        String name = "";
        String remaining = clean;
        if (!regNo.isEmpty()) remaining = remaining.replace(regNo, " ");
        if (dept != null && !dept.isEmpty()) remaining = remaining.replaceAll("(?i)\\b" + Pattern.quote(dept) + "\\b", " ");
        remaining = remaining.replaceAll("(?i)\\b(Sem(?:ester)?\\s*\\d|Year\\s*\\d|Yr\\s*\\d)\\b", " ");
        remaining = remaining.replaceAll("^\\s*\\d+\\s*", " "); // Remove leading S.No
        remaining = remaining.replaceAll("\\b\\d{1,3}(?:\\.\\d{1,2})?\\b", " "); // Remove numbers
        remaining = remaining.replaceAll("[^A-Za-z\\s.]", " ").trim();
        remaining = remaining.replaceAll("\\s+", " ").trim();

        if (remaining.length() >= 3) {
            name = remaining;
            if (name.length() > 50) name = name.substring(0, 50).trim();
        }

        // Determine if line has enough student information
        if (regNo.isEmpty() && name.isEmpty() && dept == null) {
            return null;
        }

        List<String> missing = new ArrayList<>();
        if (regNo.isBlank()) missing.add("regNo");
        if (name.isBlank()) missing.add("name");
        if (dept == null || dept.isBlank()) missing.add("dept");
        if (year == null || year == 0) missing.add("year");

        return StudentEntryDto.builder()
                .sno(String.valueOf(serialCounter))
                .regNo(regNo)
                .name(name)
                .dept(dept != null ? dept : "")
                .year(year != null ? year : 1)
                .marks(marks)
                .missingFields(missing)
                .requiresReview(!missing.isEmpty())
                .confidenceScore(missing.isEmpty() ? 0.95 : 0.70)
                .extractionMethod(method)
                .build();
    }

    private String matchDepartment(String text) {
        if (text == null) return null;
        String upper = text.toUpperCase();

        // Exact departmental keyword mapping
        if (upper.contains("COMPUTER SCIENCE AND BUSINESS") || upper.contains("CSBS")) return "CSBS";
        if (upper.contains("ARTIFICIAL INTELLIGENCE AND MACHINE") || upper.contains("AIML")) return "AIML";
        if (upper.contains("ARTIFICIAL INTELLIGENCE AND DATA") || upper.contains("AIDS") || upper.contains("AI&DS")) return "AIDS";
        if (upper.contains("COMPUTER AND COMMUNICATION") || upper.contains("CCE")) return "CCE";
        if (upper.contains("COMPUTER SCIENCE") || upper.contains("CSE")) return "CSE";
        if (upper.contains("INFORMATION TECHNOLOGY") || upper.contains("IT")) return "IT";
        if (upper.contains("ELECTRONICS AND COMMUNICATION") || upper.contains("ECE")) return "ECE";
        if (upper.contains("ELECTRICAL AND ELECTRONICS") || upper.contains("EEE")) return "EEE";
        if (upper.contains("MECHANICAL") || upper.contains("MECH")) return "MECH";
        if (upper.contains("BIOTECHNOLOGY") || upper.contains("BT")) return "BT";
        if (upper.contains("BIOMEDICAL") || upper.contains("BME")) return "BME";
        if (upper.contains("CIVIL")) return "CIVIL";
        if (upper.contains("VLSI")) return "VLSI";

        for (String d : COMMON_DEPTS) {
            if (Pattern.compile("\\b" + Pattern.quote(d) + "\\b", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
                return d;
            }
        }
        return null;
    }

    private Integer parseYearOrSem(String val) {
        if (val == null) return 1;
        String trimmed = val.trim();
        try {
            int num = Integer.parseInt(trimmed);
            if (num > 4) {
                // It's a semester (e.g. 5, 6, 7, 8)
                return (num + 1) / 2;
            }
            return Math.max(1, Math.min(num, 4));
        } catch (NumberFormatException ignored) {}

        String u = trimmed.toUpperCase();
        if (u.equals("IV") || u.equals("4")) return 4;
        if (u.equals("III") || u.equals("3")) return 3;
        if (u.equals("II") || u.equals("2")) return 2;
        if (u.equals("I") || u.equals("1")) return 1;
        return 1;
    }

    public StudentExtractionResponse parseStudentCsv(MultipartFile file) throws IOException {
        List<StudentEntryDto> list = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return buildResponse(list, "CSV");
            }

            String[] rawHeaders = headerLine.split(",");
            int snoIdx = -1, regIdx = -1, nameIdx = -1, deptIdx = -1, yearIdx = -1, marksIdx = -1;

            for (int i = 0; i < rawHeaders.length; i++) {
                String h = rawHeaders[i].trim().toLowerCase().replaceAll("[^a-z0-9]", "");
                if (h.contains("sno") || h.contains("serial")) snoIdx = i;
                else if (h.contains("reg") || h.contains("roll") || h.equals("id")) regIdx = i;
                else if (h.contains("name") || h.contains("student")) nameIdx = i;
                else if (h.contains("dept") || h.contains("branch")) deptIdx = i;
                else if (h.contains("year") || h.equals("yr") || h.contains("sem")) yearIdx = i;
                else if (h.contains("mark") || h.contains("score")) marksIdx = i;
            }

            String line;
            int counter = 1;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;

                String[] cols = trimmed.split(",", -1);
                String sno = (snoIdx != -1 && snoIdx < cols.length) ? cols[snoIdx].trim() : String.valueOf(counter);
                String regNo = (regIdx != -1 && regIdx < cols.length) ? cols[regIdx].trim() : "";
                String name = (nameIdx != -1 && nameIdx < cols.length) ? cols[nameIdx].trim() : "";
                String dept = (deptIdx != -1 && deptIdx < cols.length) ? cols[deptIdx].trim() : "";
                
                Integer year = 1;
                if (yearIdx != -1 && yearIdx < cols.length && !cols[yearIdx].isBlank()) {
                    year = parseYearOrSem(cols[yearIdx]);
                } else {
                    year = null;
                }

                Double marks = null;
                if (marksIdx != -1 && marksIdx < cols.length && !cols[marksIdx].isBlank()) {
                    try {
                        marks = Double.parseDouble(cols[marksIdx].trim());
                    } catch (Exception ignored) {}
                }

                List<String> missing = new ArrayList<>();
                if (regNo.isBlank()) missing.add("regNo");
                if (name.isBlank()) missing.add("name");
                if (dept.isBlank() || dept.equalsIgnoreCase("unknown")) missing.add("dept");
                if (year == null || year == 0) missing.add("year");

                list.add(StudentEntryDto.builder()
                        .sno(sno)
                        .regNo(regNo)
                        .name(name)
                        .dept(dept)
                        .year(year != null ? year : 1)
                        .marks(marks)
                        .missingFields(missing)
                        .requiresReview(!missing.isEmpty())
                        .confidenceScore(missing.isEmpty() ? 1.0 : 0.70)
                        .extractionMethod("CSV")
                        .build());
                counter++;
            }
        }

        return buildResponse(list, "CSV");
    }

    private StudentExtractionResponse buildResponse(List<StudentEntryDto> students, String method) {
        int missingCount = 0;
        Map<String, Integer> summary = new HashMap<>();
        summary.put("missingRegNo", 0);
        summary.put("missingName", 0);
        summary.put("missingDept", 0);
        summary.put("missingYear", 0);

        for (StudentEntryDto s : students) {
            if (!s.getMissingFields().isEmpty()) {
                missingCount++;
                for (String f : s.getMissingFields()) {
                    if (f.equals("regNo")) summary.put("missingRegNo", summary.get("missingRegNo") + 1);
                    if (f.equals("name")) summary.put("missingName", summary.get("missingName") + 1);
                    if (f.equals("dept")) summary.put("missingDept", summary.get("missingDept") + 1);
                    if (f.equals("year")) summary.put("missingYear", summary.get("missingYear") + 1);
                }
            }
        }

        String msg;
        if (students.isEmpty()) {
            msg = "No student records could be detected in the uploaded file.";
        } else if (missingCount > 0) {
            msg = "Extracted " + students.size() + " student records. " + missingCount + 
                  " records have missing data fields. Please review and fill them in before saving.";
        } else {
            msg = "Successfully extracted " + students.size() + " student records with all fields complete.";
        }

        return StudentExtractionResponse.builder()
                .students(students)
                .totalCount(students.size())
                .hasMissingFields(missingCount > 0)
                .missingCount(missingCount)
                .extractionMethod(method)
                .missingSummary(summary)
                .message(msg)
                .build();
    }
}
