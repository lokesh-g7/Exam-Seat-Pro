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

function loadFromStorage() {
  try {
    // Try new format first
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    
    // Try legacy format migration
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
      }
    }
  } catch { /* ignore */ }
  return null
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
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
    }

    // Also fetch latest timetable & students from backend
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
  }, [])

  // Persist on change
  useEffect(() => {
    saveToStorage({ students, timetable, config, seating, currentStep })
  }, [students, timetable, config, seating, currentStep])

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
      
      let backendHalls = []
      try {
        const hallsRes = await fetch('/api/halls')
        if (hallsRes.ok) backendHalls = await hallsRes.json()
      } catch (err) {
        console.warn("Failed to fetch custom database halls:", err)
      }

      setCapacityError(null)
      const res = await runWorkerTask('generate', {
        students: validStudents,
        config,
        halls: backendHalls
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
    
    let backendHalls = []
    try {
      const hallsRes = await fetch('/api/halls')
      if (hallsRes.ok) backendHalls = await hallsRes.json()
    } catch (err) {
      console.warn("Failed to fetch custom database halls:", err)
    }

    runWorkerTask('regenerate', { students: validStudents, config, halls: backendHalls }).then((res) => {
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
