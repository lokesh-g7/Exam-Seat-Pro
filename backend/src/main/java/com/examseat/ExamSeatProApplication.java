package com.examseat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ExamSeatProApplication {
    public static void main(String[] args) {
        SpringApplication.run(ExamSeatProApplication.class, args);
    }
}