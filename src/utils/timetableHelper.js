/**
 * timetableHelper.js
 * Utilities for extracting session groupings and generating/mapping students for exam sessions.
 */

export function getDistinctSessions(timetable = []) {
  if (!Array.isArray(timetable) || timetable.length === 0) return []

  const sessionMap = new Map()

  timetable.forEach(entry => {
    const date = entry.examDate || entry.date || 'Unscheduled'
    const session = entry.session || 'FN'
    const key = `${date}_${session}`

    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        date,
        session,
        label: `${date} · ${session === 'FN' ? '🌅 Forenoon (FN)' : '🌆 Afternoon (AN)'}`,
        entries: []
      })
    }

    sessionMap.get(key).entries.push(entry)
  })

  return Array.from(sessionMap.values())
}

/**
 * Filter students enrolled in the exams of a specific timetable session
 * and attach their courseCode & subject to each student record.
 */
export function filterStudentsForSession(students = [], sessionEntries = []) {
  if (!Array.isArray(students) || students.length === 0) return []
  if (!Array.isArray(sessionEntries) || sessionEntries.length === 0) return students

  const mapped = []

  students.forEach(student => {
    const sDept = (student.dept || '').toUpperCase().trim()
    const sYear = Number(student.year) || 1

    // Find matching exam entry by department & year
    const match = sessionEntries.find(e => {
      const eDept = (e.department || '').toUpperCase().trim()
      const eYear = Number(e.year) || 1
      const deptMatch = sDept === eDept || sDept.startsWith(eDept) || eDept.startsWith(sDept)
      return deptMatch && sYear === eYear
    })

    if (match) {
      mapped.push({
        ...student,
        courseCode: match.courseCode,
        subject: match.subject,
        examDate: match.examDate || match.date,
        session: match.session
      })
    }
  })

  return mapped
}

/**
 * Generate sample students tailored specifically to the timetable session exams.
 */
export function generateStudentsForSession(sessionEntries = [], countPerExam = 25) {
  if (!Array.isArray(sessionEntries) || sessionEntries.length === 0) return []

  const students = []
  let globalIndex = 1

  sessionEntries.forEach((exam) => {
    const dept = (exam.department || 'CSE').toUpperCase().trim()
    const year = Number(exam.year) || 2
    const courseCode = exam.courseCode || 'EXAM101'
    const subject = exam.subject || 'Exam Paper'
    const prefix = dept.slice(0, 3)

    for (let i = 1; i <= countPerExam; i++) {
      const regNo = `24${prefix}${String(i).padStart(3, '0')}`
      students.push({
        id: `STU_${globalIndex++}`,
        regNo,
        sno: String(globalIndex),
        name: `${dept} Student ${i}`,
        dept,
        year,
        courseCode,
        subject,
        marks: Math.floor(Math.random() * 45) + 55, // 55 - 100
        examDate: exam.examDate || exam.date,
        session: exam.session || 'FN'
      })
    }
  })

  return students
}
