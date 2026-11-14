import { useState, useEffect } from 'react'
import { AdminProvider, useAdmin } from '../../context/AdminContext'
import AdminLayout from '../../components/admin/AdminLayout'
import StudentDatabasePage from './StudentDatabasePage'
import ExamTimetablePage from './ExamTimetablePage'
import ConfigPage from './ConfigPage'
import AllocationPage from './AllocationPage'
import ExportPage from './ExportPage'
import DashboardOverview from './DashboardOverview'
import AuditLogsPage from './AuditLogsPage'

import ErrorBoundary from '../../components/ErrorBoundary'

const PAGES = [
  DashboardOverview,
  StudentDatabasePage,
  ExamTimetablePage,
  ConfigPage,
  AllocationPage,
  ExportPage,
  AuditLogsPage,
]

function DashboardContent({ onLogout }) {
  const { currentStep } = useAdmin()
  const CurrentPage = PAGES[currentStep] || StudentDatabasePage

  return (
    <AdminLayout onLogout={onLogout}>
      <ErrorBoundary key={currentStep}>
        <CurrentPage />
      </ErrorBoundary>
    </AdminLayout>
  )
}

// Save to MySQL modal component
function SaveModal({ show, onClose, onSave, isSaving, isBackendOnline }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in">
        <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3-3-3m5-7L12 1m1 11V3" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">Sync with MySQL?</h3>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          Pushing current allocations will override old data. Students will see their seats instantly.
        </p>
        
        {!isBackendOnline && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            Backend appears offline. Please start the Java Spring Boot server on port 8080.
          </div>
        )}
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onSave} 
            disabled={isSaving || !isBackendOnline} 
            className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSaving ? 'Syncing...' : 'Yes, Sync & Logout'}
          </button>
          <button onClick={onClose} className="btn-secondary w-full">
            Cancel
          </button>
          <button 
            onClick={() => { onClose(); onLogout?.(); }} 
            className="text-white/20 hover:text-white/40 text-xs font-bold pt-2"
          >
            Skip & Logout
          </button>
        </div>
      </div>
    </div>
  )
}

function DashboardWithSave({ onLogout }) {
  const { seating, students, config, flattenHalls } = useAdmin()
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isBackendOnline, setIsBackendOnline] = useState(false)

  // Check backend status (using proxy)
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/allocations/health', { 
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        })
        setIsBackendOnline(res.ok)
      } catch {
        setIsBackendOnline(false)
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleLogoutClick = () => {
    if (seating.length > 0) {
      setShowSaveModal(true)
    } else {
      onLogout()
    }
  }

  const handleSaveToMySQL = async () => {
    if (!isBackendOnline) {
      alert('CANNOT SYNC: The Java Spring Boot backend is not running.')
      return
    }

    setIsSaving(true)
    try {
      const flat = flattenHalls?.(seating, config.mode) || []
      
      // 1. Sync Students (deduplicated by regNo)
      const seenReg = new Set()
      const studentPayload = []
      for (const s of (students || [])) {
        const reg = (s.regNo || s.id || '').trim()
        if (!reg || seenReg.has(reg.toUpperCase())) continue
        seenReg.add(reg.toUpperCase())
        studentPayload.push({
          regNo: reg,
          sno: s.sno,
          name: s.name,
          dept: s.dept,
          year: s.year || s.examYear || 1,
          marks: s.marks
        })
      }

      const studentRes = await fetch('/api/students/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentPayload),
      })

      if (!studentRes.ok) {
        let errMsg = studentRes.statusText
        try {
          const errData = await studentRes.json()
          if (errData && errData.error) errMsg = errData.error
        } catch {}
        throw new Error(`Student Sync Failed: ${errMsg}`)
      }

      // 2. Sync Allocations (deduplicated by regNo)
      const seenAlloc = new Set()
      const allocPayload = []
      for (const f of flat) {
        const reg = (f.regNo || f.id || '').trim()
        if (!reg || seenAlloc.has(reg.toUpperCase())) continue
        seenAlloc.add(reg.toUpperCase())
        allocPayload.push({
          ...f,
          regNo: reg,
          seatRow: f.row,
          seatCol: f.col,
        })
      }

      const allocRes = await fetch('/api/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          allocations: allocPayload 
        }),
      })

      if (!allocRes.ok) {
        let errMsg = allocRes.statusText
        try {
          const errData = await allocRes.json()
          if (errData && errData.error) errMsg = errData.error
        } catch {}
        throw new Error(`Allocation Sync Failed: ${errMsg}`)
      }

      alert('SUCCESS: All data synced to database.')
      setShowSaveModal(false)
      onLogout()
    } catch (err) {
      console.error(err)
      if (err.message.includes('Failed to fetch')) {
        alert('SYNC ERROR: Connection lost. Is the Java backend still running?')
      } else {
        alert('SYNC ERROR: ' + err.message)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <DashboardContent onLogout={handleLogoutClick} />
      <SaveModal 
        show={showSaveModal} 
        onClose={() => setShowSaveModal(false)} 
        onSave={handleSaveToMySQL}
        isSaving={isSaving}
        isBackendOnline={isBackendOnline}
      />
    </>
  )
}

export default function AdminDashboard({ onLogout }) {
  return (
    <AdminProvider>
      <DashboardWithSave onLogout={onLogout} />
    </AdminProvider>
  )
}
