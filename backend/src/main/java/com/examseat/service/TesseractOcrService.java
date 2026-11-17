package com.examseat.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

/**
 * Tesseract OCR Service
 * Automatically detects Tesseract binary matching the discovery order from
 * "MTM- Smart Admission Document Validation":
 * 1. TESSERACT_CMD environment variable
 * 2. C:\Program Files\Tesseract-OCR\tesseract.exe
 * 3. C:\Program Files (x86)\Tesseract-OCR\tesseract.exe
 * 4. System PATH via 'where tesseract'
 */
@Service
public class TesseractOcrService {

    private static final Logger log = LoggerFactory.getLogger(TesseractOcrService.class);

    private String resolvedTesseractPath = null;
    private Boolean tesseractAvailable = null;

    public TesseractOcrService() {
        initTesseractPath();
    }

    private synchronized void initTesseractPath() {
        if (resolvedTesseractPath != null && Boolean.TRUE.equals(tesseractAvailable)) return;

        // 1. Check environment variable
        String envCmd = System.getenv("TESSERACT_CMD");
        if (envCmd != null && !envCmd.isBlank()) {
            File f = new File(envCmd);
            if (f.exists() && f.isFile()) {
                resolvedTesseractPath = f.getAbsolutePath();
                tesseractAvailable = true;
                log.info("Tesseract found via TESSERACT_CMD: {}", resolvedTesseractPath);
                return;
            }
        }

        // 2. Linux / Docker / Cloud paths (Render, Ubuntu, Debian, Alpine)
        String[] linuxCandidates = {
            "/usr/bin/tesseract",
            "/usr/local/bin/tesseract",
            "/opt/homebrew/bin/tesseract"
        };
        for (String candidate : linuxCandidates) {
            File f = new File(candidate);
            if (f.exists() && f.isFile() && f.canExecute()) {
                resolvedTesseractPath = f.getAbsolutePath();
                tesseractAvailable = true;
                log.info("Tesseract found at Linux/Cloud path: {}", resolvedTesseractPath);
                return;
            }
        }

        // 3. Windows Standard Program Files
        File pf64 = new File("C:\\Program Files\\Tesseract-OCR\\tesseract.exe");
        if (pf64.exists() && pf64.isFile()) {
            resolvedTesseractPath = pf64.getAbsolutePath();
            tesseractAvailable = true;
            log.info("Tesseract found in Program Files: {}", resolvedTesseractPath);
            return;
        }

        // 4. Windows Standard Program Files (x86)
        File pf86 = new File("C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe");
        if (pf86.exists() && pf86.isFile()) {
            resolvedTesseractPath = pf86.getAbsolutePath();
            tesseractAvailable = true;
            log.info("Tesseract found in Program Files (x86): {}", resolvedTesseractPath);
            return;
        }

        // 5. Test direct execution on system PATH (cross-platform: Linux, Mac, Windows)
        try {
            Process process = new ProcessBuilder("tesseract", "--version").start();
            int exitCode = process.waitFor();
            if (exitCode == 0) {
                resolvedTesseractPath = "tesseract";
                tesseractAvailable = true;
                log.info("Tesseract verified via direct system PATH invocation ('tesseract --version')");
                return;
            }
        } catch (Exception ignored) {
        }

        // 6. Try Linux/Mac 'which tesseract'
        try {
            Process process = new ProcessBuilder("which", "tesseract").start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                if (line != null && !line.isBlank()) {
                    File f = new File(line.trim());
                    if (f.exists() && f.isFile()) {
                        resolvedTesseractPath = f.getAbsolutePath();
                        tesseractAvailable = true;
                        log.info("Tesseract found via 'which tesseract': {}", resolvedTesseractPath);
                        return;
                    }
                }
            }
            process.waitFor();
        } catch (Exception ignored) {
        }

        // 7. Try Windows 'where tesseract'
        try {
            Process process = new ProcessBuilder("where", "tesseract").start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line = reader.readLine();
                if (line != null && !line.isBlank()) {
                    File f = new File(line.trim());
                    if (f.exists() && f.isFile()) {
                        resolvedTesseractPath = f.getAbsolutePath();
                        tesseractAvailable = true;
                        log.info("Tesseract found on Windows PATH: {}", resolvedTesseractPath);
                        return;
                    }
                }
            }
            process.waitFor();
        } catch (Exception ignored) {
        }

        // Fallback default
        resolvedTesseractPath = "tesseract";
        tesseractAvailable = false;
        log.warn("Tesseract executable not found. OCR features will attempt PATH or default command.");
    }

    public boolean isAvailable() {
        if (tesseractAvailable == null) {
            initTesseractPath();
        }
        return Boolean.TRUE.equals(tesseractAvailable);
    }

    public String getTesseractPath() {
        return resolvedTesseractPath;
    }

    /**
     * Run OCR on a single BufferedImage.
     * @param image BufferedImage of page
     * @param psm Page segmentation mode (e.g. 6 for uniform block of text, 3 for auto)
     * @return Extracted OCR text
     */
    public String extractTextFromImage(BufferedImage image, int psm) throws IOException {
        File tempImage = File.createTempFile("ocr_page_", ".png");
        try {
            ImageIO.write(image, "PNG", tempImage);
            return runTesseract(tempImage.getAbsolutePath(), psm);
        } finally {
            try {
                Files.deleteIfExists(tempImage.toPath());
            } catch (Exception ignored) {}
        }
    }

    /**
     * Run OCR on all pages of a PDDocument.
     * @param document Loaded PDDocument
     * @param dpi DPI resolution (e.g. 300)
     * @param psm Page segmentation mode (e.g. 6)
     * @return Combined text of all pages
     */
    public String extractTextFromPdf(PDDocument document, int dpi, int psm) throws IOException {
        PDFRenderer renderer = new PDFRenderer(document);
        int pageCount = document.getNumberOfPages();
        StringBuilder combinedText = new StringBuilder();

        for (int i = 0; i < pageCount; i++) {
            BufferedImage bim = renderer.renderImageWithDPI(i, dpi, ImageType.RGB);
            String pageText = extractTextFromImage(bim, psm);
            combinedText.append(pageText).append("\n");
        }

        return combinedText.toString();
    }

    /**
     * Run OCR on PDF pages and return page-by-page text list.
     */
    public List<String> extractTextByPages(PDDocument document, int dpi, int psm) throws IOException {
        PDFRenderer renderer = new PDFRenderer(document);
        int pageCount = document.getNumberOfPages();
        List<String> pages = new ArrayList<>();

        for (int i = 0; i < pageCount; i++) {
            BufferedImage bim = renderer.renderImageWithDPI(i, dpi, ImageType.RGB);
            String pageText = extractTextFromImage(bim, psm);
            pages.add(pageText);
        }

        return pages;
    }

    private String runTesseract(String imagePath, int psm) throws IOException {
        String executable = (resolvedTesseractPath != null) ? resolvedTesseractPath : "tesseract";

        List<String> command = new ArrayList<>();
        command.add(executable);
        command.add(imagePath);
        command.add("stdout");
        command.add("--psm");
        command.add(String.valueOf(psm));

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);

        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }

        try {
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                log.warn("Tesseract process exited with code {}", exitCode);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("OCR interrupted", e);
        }

        return output.toString();
    }
}

