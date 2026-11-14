package com.examseat.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "allocations")
@JsonIgnoreProperties(ignoreUnknown = true)
public class Allocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String regNo;

    private String name;
    private String dept;
    @Column(name = "exam_year")
    private Integer examYear;
    private Double marks;
    
    private Integer hall;
    private String hallName;
    private Integer seat;
    private Integer seatRow;
    private Integer seatCol;
    
    private String examMode;
    private String courseCode;
    private String subject;
    private String examDate;
    private String session;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRegNo() { return regNo; }
    public void setRegNo(String regNo) { this.regNo = regNo; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDept() { return dept; }
    public void setDept(String dept) { this.dept = dept; }
    public Integer getExamYear() { return examYear; }
    public void setExamYear(Integer examYear) { this.examYear = examYear; }
    @JsonProperty("year")
    public Integer getYear() { return examYear; }
    @JsonProperty("year")
    public void setYear(Integer year) { this.examYear = year; }
    public Double getMarks() { return marks; }
    public void setMarks(Double marks) { this.marks = marks; }
    public Integer getHall() { return hall; }
    public void setHall(Integer hall) { this.hall = hall; }
    public String getHallName() { return hallName; }
    public void setHallName(String hallName) { this.hallName = hallName; }
    public Integer getSeat() { return seat; }
    public void setSeat(Integer seat) { this.seat = seat; }
    public Integer getSeatRow() { return seatRow; }
    public void setSeatRow(Integer seatRow) { this.seatRow = seatRow; }
    @JsonProperty("row")
    public Integer getRow() { return seatRow; }
    @JsonProperty("row")
    public void setRow(Integer row) { this.seatRow = row; }
    public Integer getSeatCol() { return seatCol; }
    public void setSeatCol(Integer seatCol) { this.seatCol = seatCol; }
    @JsonProperty("col")
    public Integer getCol() { return seatCol; }
    @JsonProperty("col")
    public void setCol(Integer col) { this.seatCol = col; }
    public String getExamMode() { return examMode; }
    public void setExamMode(String examMode) { this.examMode = examMode; }
    public String getCourseCode() { return courseCode; }
    public void setCourseCode(String courseCode) { this.courseCode = courseCode; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getExamDate() { return examDate; }
    public void setExamDate(String examDate) { this.examDate = examDate; }
    public String getSession() { return session; }
    public void setSession(String session) { this.session = session; }
}