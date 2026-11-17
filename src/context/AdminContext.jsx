import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { flattenHalls, MODES } from '../utils/seatingEngine'

const AdminContext = createContext(null)

const STORAGE_KEY = 'examseat_pro_admin_v2'
const LEGACY_KEY = 'examseat_pro_data'

const DEFAULT_CONFIG = {
  mode: MODES.SEMESTER,
  session: 'FN',
  algorithm: 'optimized',
}

export const DEFAULT_HALLS = [
  { id: 1, hallName: 'Hall A (Main Block)', rowsCount: 15, columnsCount: 10, seatsPerTable: 1, blockedSeats: '', accessibilitySeats: '0-0,0-1', seatingModes: 'semester,internal', allowedExamTypes: 'Internal Examination,University Examination', active: true },
  { id: 2, hallName: 'Hall B (East Wing)', rowsCount: 12, columnsCount: 10, seatsPerTable: 1, blockedSeats: '', accessibilitySeats: '0-0,0-1', seatingModes: 'semester,internal', allowedExamTypes: 'Internal Examination,University Examination', active: true },
  { id: 3, hallName: 'Hall C (Lab Block)', rowsCount: 10, columnsCount: 8, seatsPerTable: 2, blockedSeats: '', accessibilitySeats: '0-0', seatingModes: 'internal', allowedExamTypes: 'Internal Examination', active: true },
  { id: 4, hallName: 'Hall D (West Wing)', rowsCount: 10, columnsCount: 8, seatsPerTable: 1, blockedSeats: '', accessibilitySeats: '', seatingModes: 'semester', allowedExamTypes: 'University Examination', active: true }
]

export const DEFAULT_DEPTS = [
  { id: 1, departmentCode: 'CSE', departmentName: 'Computer Science and Engineering', program: 'B.E.', regulations: '2021', active: true },
  { id: 2, departmentCode: 'ECE', departmentName: 'Electronics and Communication', program: 'B.E.', regulations: '2021', active: true },
  { id: 3, departmentCode: 'EEE', departmentName: 'Electrical and Electronics', program: 'B.E.', regulations: '2021', active: true },
  { id: 4, departmentCode: 'IT', departmentName: 'Information Technology', program: 'B.Tech', regulations: '2021', active: true },
  { id: 5, departmentCode: 'CSBS', departmentName: 'Computer Science and Business Systems', program: 'B.Tech', regulations: '2021', active: true }
]

export const DEFAULT_SEMESTERS = [
  { id: 1, semesterNumber: 1, academicYear: '2025-26', regulation: '2021', departmentCode: 'CSE' },
  { id: 2, semesterNumber: 3, academicYear: '2025-26', regulation: '2021', departmentCode: 'CSE' },
  { id: 3, semesterNumber: 5, academicYear: '2025-26', regulation: '2021', departmentCode: 'CSE' },
  { id: 4, semesterNumber: 3, academicYear: '2025-26', regulation: '2021', departmentCode: 'CSBS' },
  { id: 5, semesterNumber: 5, academicYear: '2025-26', regulation: '2021', departmentCode: 'ECE' }
]

export const DEFAULT_SUBJECTS = [
  { id: 1, subjectCode: 'CS3001', subjectName: 'Artificial Intelligence', departmentCode: 'CSE', semester: 3, regulation: '2021', examType: 'University Examination', active: true },
  { id: 2, subjectCode: 'CS3002', subjectName: 'Database Management Systems', departmentCode: 'CSE', semester: 3, regulation: '2021', examType: 'University Examination', active: true },
  { id: 3, subjectCode: 'CS3003', subjectName: 'Computer Networks', departmentCode: 'CSE', semester: 3, regulation: '2021', examType: 'University Examination', active: true },
  { id: 4, subjectCode: 'CB3001', subjectName: 'Design Thinking & Innovation', departmentCode: 'CSBS', semester: 3, regulation: '2021', examType: 'University Examination', active: true },
  { id: 5, subjectCode: 'EC3001', subjectName: 'Digital Signal Processing', departmentCode: 'ECE', semester: 3, regulation: '2021', examType: 'University Examination', active: true },
  { id: 6, subjectCode: 'EC3002', subjectName: 'Microcontrollers', departmentCode: 'ECE', semester: 3, regulation: '2021', examType: 'University Examination', active: true }
]

export const DEFAULT_INVIGILATORS = [
  { id: 1, name: 'Dr. Sarah Connor', email: 'sarah@college.edu', departmentCode: 'CSE', availabilityStatus: 'Available', maxWorkloadHours: 12 },
  { id: 2, name: 'Prof. Charles Xavier', email: 'xavier@college.edu', departmentCode: 'ECE', availabilityStatus: 'Available', maxWorkloadHours: 12 },
  { id: 3, name: 'Dr. Bruce Banner', email: 'banner@college.edu', departmentCode: 'EEE', availabilityStatus: 'Available', maxWorkloadHours: 8 }
]

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const data = JSON.parse(legacy)
      return {
        students: data.students || [],
        timetable: [],
        config: {
          mode: data.examMode || MODES.SEMESTER,
          session: 'FN',
          algorithm: data.algorithm || 'optimized',
        },
        seating: data.halls || [],
        currentStep: 0,
        halls: DEFAULT_HALLS,
        depts: DEFAULT_DEPTS,
        semesters: DEFAULT_SEMESTERS,
        subjects: DEFAULT_SUBJECTS,
        invigilators: DEFAULT_INVIGILATORS
      }
    }
  } catch { /* ignore */ }
  return null
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    localStorage.setItem('examseat_pro_admin_state', JSON.stringify(data))
  } catch { /* ignore */ }
}

export function AdminProvider({ children }) {
  const [students, setStudents] = useState([])
  const [timetable, setTimetable] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [seating, setSeating] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [optimizationStats, setOptimizationStats] = useState(null)
  const [capacityError, setCapacityError] = useState(null)

  // Master Data State
  const [halls, setHalls] = useState(DEFAULT_HALLS)
  const [depts, setDepts] = useState(DEFAULT_DEPTS)
  const [semesters, setSemesters] = useState(DEFAULT_SEMESTERS)
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS)
  const [invigilators, setInvigilators] = useState(DEFAULT_INVIGILATORS)
  
  // Web Worker ref
  const workerRef = useRef(null)
  const pendingResolveRef = useRef(null)

  // Load on mount
  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      setStudents(saved.students || [])
      setTimetable(saved.timetable || [])
      setConfig(saved.config || DEFAULT_CONFIG)
      setSeating(saved.seating || [])
      setCurrentStep(saved.currentStep || 0)
      if (saved.halls && saved.halls.length > 0) setHalls(saved.halls)
      if (saved.depts && saved.depts.length > 0) setDepts(saved.depts)
      if (saved.semesters && saved.semesters.length > 0) setSemesters(saved.semesters)
      if (saved.subjects && saved.subjects.length > 0) setSubjects(saved.subjects)
      if (saved.invigilators && saved.invigilators.length > 0) setInvigilators(saved.invigilators)
    }

    // Try fetching from backend if live
    fetch('/api/timetable')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTimetable(prev => prev.length === 0 ? data : prev)
        }
      })
      .catch(() => {})

    fetch('/api/students')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setStudents(prev => prev.length === 0 ? data : prev)
        }
      })
      .catch(() => {})

    fetch('/api/halls')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setHalls(data) })
      .catch(() => {})

    fetch('/api/departments')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setDepts(data) })
      .catch(() => {})

    fetch('/api/semesters')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setSemesters(data) })
      .catch(() => {})

    fetch('/api/subjects')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setSubjects(data) })
      .catch(() => {})

    fetch('/api/invigilators')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data) && data.length > 0) setInvigilators(data) })
      .catch(() => {})
  }, [])

  // Persist on change
  useEffect(() => {
    saveToStorage({ students, timetable, config, seating, currentStep, halls, depts, semesters, subjects, invigilators })
  }, [students, timetable, config, seating, currentStep, halls, depts, semesters, subjects, invigilators])

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/seatingWorker.js', import.meta.url),
      { type: 'module' }
    )
    
    workerRef.current.onmessage = (e) => {
      const { type, result, stats, progress, error, currentHall, totalHalls, elapsed } = e.data
      
      if (type === 'progress') {
        setGenerationProgress(progress)
        setOptimizationStats({ currentHall, totalHalls, elapsed })
      } else if (type === 'complete') {
        if (pendingResolveRef.current) {
          pendingResolveRef.current({ result, stats })
          pendingResolveRef.current = null
        }
      } else if (type === 'error') {
        console.error('Worker error:', error)
        if (pendingResolveRef.current) {
          pendingResolveRef.current(e.data)
          pendingResolveRef.current = null
        }
      }
    }
    
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  const addStudents = useCallback((newStudents) => {
    setStudents(prev => [...prev, ...newStudents])
  }, [])

  const removeStudent = useCallback((regNo) => {
    setStudents(prev => prev.filter(s => s.regNo !== regNo))
    setSeating([]) // Reset seating when students change
  }, [])

  const updateStudent = useCallback((regNo, updates) => {
    setStudents(prev => prev.map(s => s.regNo === regNo ? { ...s, ...updates } : s))
    setSeating([])
  }, [])

  const addSavedEntriesToTimetable = useCallback((entries) => {
    setTimetable(prev => [...prev, ...entries])
  }, [])

  const clearStudents = useCallback(() => {
    setStudents([])
    setSeating([])
  }, [])

  const addTimetableEntry = useCallback((entry) => {
    setTimetable(prev => [...prev, { ...entry, id: Date.now() }])
  }, [])

  const removeTimetableEntry = useCallback((id) => {
    setTimetable(prev => prev.filter(e => e.id !== id))
  }, [])

  const updateTimetableEntry = useCallback((id, updates) => {
    setTimetable(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [])

  const uploadTimetablePdf = useCallback(async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('/api/timetable/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) throw new Error('Failed to parse PDF')
    return response.json()
  }, [])

  const saveParsedTimetable = useCallback(async (entries) => {
    const response = await fetch('/api/timetable/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries)
    })
    
    if (!response.ok) throw new Error('Failed to save timetable')
    const saved = await response.json()
    setTimetable(prev => [...prev, ...saved])
    return saved
  }, [])

  const updateConfig = useCallback((updates) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const runWorkerTask = useCallback((type, data) => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve({ error: 'Worker not initialized' })
        return
      }
      pendingResolveRef.current = resolve
      workerRef.current.postMessage({ type, ...data })
    })
  }, [])

  const generateSeating = useCallback(async (customStudents = null) => {
    const studentPool = (customStudents && Array.isArray(customStudents)) ? customStudents : students
    // Data guard: check students exist
    if (!studentPool || !Array.isArray(studentPool) || studentPool.length === 0) {
      console.warn('Cannot generate seating: No students provided')
      alert('Please add or populate students first!')
      return
    }
    
    // Data guard: check config is valid
    if (!config || !config.mode || !config.algorithm) {
      console.warn('Cannot generate seating: Invalid configuration')
      return
    }
    
    console.log('Starting generation with:', { 
      studentCount: studentPool.length, 
      mode: config.mode, 
      algorithm: config.algorithm 
    })
    
    setIsGenerating(true)
    setGenerationProgress(0)
    setOptimizationStats(null)
    
    try {
      const validStudents = studentPool.filter(s => s && (s.id || s.regNo))
      console.log('Valid students for seating:', validStudents.length)
      
      if (validStudents.length === 0) {
        console.error('No valid students found after filtering')
        alert('No valid students found. Please check student data.')
        setIsGenerating(false)
        return
      }
      
      // Use configured active halls from state, or fallback to default halls
      const activeHalls = (halls && halls.length > 0)
        ? halls.filter(h => h.active !== false)
        : DEFAULT_HALLS

      setCapacityError(null)
      const res = await runWorkerTask('generate', {
        students: validStudents,
        config,
        halls: activeHalls
      })
      
      if (res.error) {
        console.error('Generation error:', res.error)
        setCapacityError(res.error)
      } else if (res.result && Array.isArray(res.result)) {
        setCapacityError(null)
        console.log('Generation complete! Halls:', res.result.length)
        setSeating(res.result)
        setOptimizationStats(res.stats)
      } else {
        console.warn('Invalid result from worker:', res.result)
        setCapacityError('Generation returned invalid result')
      }
    } catch (err) {
      console.error('Unexpected error during generation:', err)
      setCapacityError(err.message)
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }, [students, config, runWorkerTask])

  const regenerateSeating = useCallback(async (customStudents = null) => {
    // Use 'regenerate' type for maximum power conflict resolution
    const studentPool = (customStudents && Array.isArray(customStudents)) ? customStudents : students
    if (!studentPool || studentPool.length === 0) return
    
    setIsGenerating(true)
    setGenerationProgress(0)
    setOptimizationStats(null)
    setCapacityError(null)
    
    const validStudents = studentPool.filter(s => s && (s.id || s.regNo))
    if (validStudents.length === 0) { setIsGenerating(false); return }
    
    const activeHalls = (halls && halls.length > 0)
      ? halls.filter(h => h.active !== false)
      : DEFAULT_HALLS

    runWorkerTask('regenerate', { students: validStudents, config, halls: activeHalls }).then((res) => {
      if (res.error) {
        console.error('Regeneration error:', res.error)
        setCapacityError(res.error)
      } else if (res.result && Array.isArray(res.result)) {
        setCapacityError(null)
        setSeating(res.result)
        setOptimizationStats(res.stats)
      }
      setIsGenerating(false)
      setGenerationProgress(0)
    })
  }, [students, config, runWorkerTask])

  const runAutoOptimize = useCallback(async () => {
    if (seating.length === 0) return
    
    setIsOptimizing(true)
    setGenerationProgress(0)
    
    // Optimize each hall sequentially with progress
    const optimizedHalls = []
    let totalScore = 0
    
    for (let i = 0; i < seating.length; i++) {
      const { result, stats, error } = await runWorkerTask('optimize', {
        students: seating[i],
        config,
        hallIndex: i
      })
      
      if (error) {
        console.error('Optimization error:', error)
        optimizedHalls.push(seating[i])
      } else {
        optimizedHalls.push(result)
        totalScore += stats?.conflictScore || 0
      }
      
      setGenerationProgress(Math.round(((i + 1) / seating.length) * 100))
    }
    
    setSeating(optimizedHalls)
    setIsOptimizing(false)
    setGenerationProgress(0)
  }, [seating, config, runWorkerTask])

  const clearSeating = useCallback(() => {
    setSeating([])
  }, [])

  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  const publishAllocations = useCallback(async () => {
    if (seating.length === 0) return

    setIsPublishing(true)
    setPublishResult(null)

    try {
      const flat = flattenHalls(seating, config.mode)

      // Deduplicate by regNo to prevent unique key violation
      const seenRegNos = new Set()
      const allocations = []
      
      for (const s of flat) {
        const reg = s.regNo || s.id
        if (!reg || seenRegNos.has(reg)) continue
        seenRegNos.add(reg)
        allocations.push({
          regNo: reg,
          name: s.name,
          dept: s.dept,
          examYear: s.year || s.examYear || 1,
          marks: s.marks ?? null,
          hall: s.hall,
          hallName: s.hallName || `Hall ${s.hall}`,
          seat: s.seat,
          seatRow: s.row || s.seatRow || 1,
          seatCol: s.col || s.seatCol || 1,
          examMode: s.examMode,
          courseCode: s.courseCode || '',
          subject: s.subject || '',
          examDate: s.examDate || '',
          session: s.session || ''
        })
      }

      // Persist allocations to client storage (enables Student Portal lookup anywhere, even without cloud DB)
      try {
        localStorage.setItem('examseat_published_allocations', JSON.stringify(allocations))
        localStorage.setItem('examseat_published_seating', JSON.stringify(seating))
      } catch {}

      // 1. Save allocations to backend if reachable
      let data = { message: `Published ${allocations.length} allocations.` }
      try {
        const response = await fetch('/api/allocations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allocations })
        })

        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            data = await response.json()
          }
        }
      } catch (apiErr) {
        console.warn('[AdminContext] Backend sync note:', apiErr.message)
      }

      // 2. Also sync students to the backend database so their profiles are stored
      const seenStudentRegNos = new Set()
      const studentPayload = []
      for (const s of students) {
        const reg = s.regNo || s.id
        if (!reg || seenStudentRegNos.has(reg)) continue
        seenStudentRegNos.add(reg)
        studentPayload.push({
          regNo: reg,
          sno: s.sno,
          name: s.name,
          dept: s.dept,
          examYear: s.year || s.examYear || 1,
          marks: s.marks ?? null,
        })
      }

      try {
        await fetch('/api/students/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(studentPayload)
        })
      } catch (syncErr) {
        console.warn('Student sync warning:', syncErr.message)
      }

      // 3. Register SeatingVersion as PUBLISHED
      try {
        await fetch('/api/seating-versions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationId: 'gen_' + Date.now(),
            version: 1,
            creator: 'admin',
            status: 'PUBLISHED',
            allocationsJson: JSON.stringify(seating)
          })
        })
      } catch (verErr) {
        console.warn('Version registration note:', verErr.message)
      }

      setPublishResult({ success: true, message: data.message || `Published ${allocations.length} allocations.` })
      return data
    } catch (err) {
      console.error('Publish error:', err)
      setPublishResult({ success: false, message: err.message })
      throw err
    } finally {
      setIsPublishing(false)
    }
  }, [seating, students, config])

  const goToStep = useCallback((step) => {
    setCurrentStep(step)
  }, [])

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, 6))
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: return true // Dashboard Overview always valid
      case 1: return students.length > 0 // Student Database
      case 2: return timetable.length > 0 // Timetable
      case 3: return true // Config always valid
      case 4: return seating.length > 0 // Seating Allocation
      case 5: return true // Export page
      case 6: return true // Audit logs
      default: return false
    }
  }, [currentStep, students.length, timetable.length, seating.length])

  // ─── Master Data CRUD Operations (with immediate state & localStorage persistence) ───
  const saveHall = useCallback(async (hallData) => {
    const isEdit = Boolean(hallData.id)
    const id = hallData.id || Date.now()
    const item = { ...hallData, id }
    setHalls(prev => {
      const exists = prev.some(h => h.id === id)
      return exists ? prev.map(h => h.id === id ? item : h) : [...prev, item]
    })
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `/api/halls/${id}` : '/api/halls'
      fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).catch(() => {})
    } catch {}
    return item
  }, [])

  const deleteHall = useCallback(async (id) => {
    setHalls(prev => prev.filter(h => h.id !== id))
    try {
      fetch(`/api/halls/${id}`, { method: 'DELETE' }).catch(() => {})
    } catch {}
  }, [])

  const saveDept = useCallback(async (deptData) => {
    const isEdit = Boolean(deptData.id)
    const id = deptData.id || Date.now()
    const item = { ...deptData, id }
    setDepts(prev => {
      const exists = prev.some(d => d.id === id)
      return exists ? prev.map(d => d.id === id ? item : d) : [...prev, item]
    })
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `/api/departments/${id}` : '/api/departments'
      fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).catch(() => {})
    } catch {}
    return item
  }, [])

  const deleteDept = useCallback(async (id) => {
    setDepts(prev => prev.filter(d => d.id !== id))
    try {
      fetch(`/api/departments/${id}`, { method: 'DELETE' }).catch(() => {})
    } catch {}
  }, [])

  const saveSem = useCallback(async (semData) => {
    const isEdit = Boolean(semData.id)
    const id = semData.id || Date.now()
    const item = { ...semData, id }
    setSemesters(prev => {
      const exists = prev.some(s => s.id === id)
      return exists ? prev.map(s => s.id === id ? item : s) : [...prev, item]
    })
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `/api/semesters/${id}` : '/api/semesters'
      fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).catch(() => {})
    } catch {}
    return item
  }, [])

  const deleteSem = useCallback(async (id) => {
    setSemesters(prev => prev.filter(s => s.id !== id))
    try {
      fetch(`/api/semesters/${id}`, { method: 'DELETE' }).catch(() => {})
    } catch {}
  }, [])

  const saveSubject = useCallback(async (subData) => {
    const isEdit = Boolean(subData.id)
    const id = subData.id || Date.now()
    const item = { ...subData, id }
    setSubjects(prev => {
      const exists = prev.some(s => s.id === id || s.subjectCode === subData.subjectCode)
      return exists ? prev.map(s => (s.id === id || s.subjectCode === subData.subjectCode) ? item : s) : [...prev, item]
    })
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `/api/subjects/${id}` : '/api/subjects'
      fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).catch(() => {})
    } catch {}
    return item
  }, [])

  const deleteSubject = useCallback(async (id) => {
    setSubjects(prev => prev.filter(s => s.id !== id))
    try {
      fetch(`/api/subjects/${id}`, { method: 'DELETE' }).catch(() => {})
    } catch {}
  }, [])

  const saveInvigilator = useCallback(async (invData) => {
    const isEdit = Boolean(invData.id)
    const id = invData.id || Date.now()
    const item = { ...invData, id }
    setInvigilators(prev => {
      const exists = prev.some(i => i.id === id)
      return exists ? prev.map(i => i.id === id ? item : i) : [...prev, item]
    })
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `/api/invigilators/${id}` : '/api/invigilators'
      fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).catch(() => {})
    } catch {}
    return item
  }, [])

  const deleteInvig = useCallback(async (id) => {
    setInvigilators(prev => prev.filter(i => i.id !== id))
    try {
      fetch(`/api/invigilators/${id}`, { method: 'DELETE' }).catch(() => {})
    } catch {}
  }, [])

  const value = {
    students,
    setStudents,
    timetable,
    setTimetable,
    config,
    seating,
    setSeating,
    setOptimizationStats,
    currentStep,
    isGenerating,
    isOptimizing,
    generationProgress,
    optimizationStats,
    capacityError,
    setCapacityError,
    runAutoOptimize,
    addStudents,
    removeStudent,
    updateStudent,
    clearStudents,
    addTimetableEntry,
    removeTimetableEntry,
    updateTimetableEntry,
    addSavedEntriesToTimetable,
    uploadTimetablePdf,
    saveParsedTimetable,
    updateConfig,
    generateSeating,
    regenerateSeating,
    clearSeating,
    publishAllocations,
    isPublishing,
    publishResult,
    goToStep,
    nextStep,
    prevStep,
    canProceed,
    flattenHalls,
    // Master Data
    halls,
    setHalls,
    saveHall,
    deleteHall,
    depts,
    setDepts,
    saveDept,
    deleteDept,
    semesters,
    setSemesters,
    saveSem,
    deleteSem,
    subjects,
    setSubjects,
    saveSubject,
    deleteSubject,
    invigilators,
    setInvigilators,
    saveInvigilator,
    deleteInvig,
  }

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider')
  }
  return context
}
