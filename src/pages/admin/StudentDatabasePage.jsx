import { useState, useRef, useEffect, useCallback } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { parseCSV, generateSampleData } from '../../utils/seatingEngine'
import { sanitizeText, sanitizeObject } from '../../utils/sanitize'

const DEPT_COLORS = [
  'from-indigo-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-purple-500',
  'from-cyan-500 to-sky-500',
  'from-lime-500 to-green-500',
  'from-fuchsia-500 to-pink-500',
]

const SUB_TABS = [
  { id: 'students', label: 'Students', icon: '👥' },
  { id: 'halls', label: 'Exam Halls', icon: '🏛️' },
  { id: 'departments', label: 'Departments', icon: '🏢' },
  { id: 'semesters', label: 'Semesters', icon: '📅' },
  { id: 'subjects', label: 'Subjects', icon: '📚' },
  { id: 'invigilators', label: 'Invigilators', icon: '🛡️' },
]

// ─── OCR Admin Review Panel ──────────────────────────────────────────────────
function OcrReviewPanel({ extractedData, onSave, onDiscard }) {
  const [rows, setRows] = useState(() =>
    (extractedData?.students || []).map((s, i) => ({ ...s, _id: i }))
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const hasMissing = rows.some(r => r.requiresReview || (r.missingFields && r.missingFields.length > 0))
  const missingCount = rows.filter(r => r.requiresReview || (r.missingFields && r.missingFields.length > 0)).length

  function updateRow(id, field, value) {
    setRows(prev =>
      prev.map(r => {
        if (r._id !== id) return r
        const updated = { ...r, [field]: value }
        // Re-evaluate missing fields after edit
        const missing = []
        if (!updated.regNo || updated.regNo.trim() === '') missing.push('regNo')
        if (!updated.name || updated.name.trim() === '') missing.push('name')
        if (!updated.dept || updated.dept.trim() === '') missing.push('dept')
        if (!updated.year || updated.year < 1) missing.push('year')
        updated.missingFields = missing
        updated.requiresReview = missing.length > 0
        return updated
      })
    )
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/students/save-extracted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Failed to save students')
        return
      }
      onSave(rows, data)
    } catch (e) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const isMissingField = (row, field) =>
    row.missingFields && row.missingFields.includes(field)

  const cellCls = (row, field) =>
    `bg-white/10 border rounded px-2 py-1 text-sm w-full transition-all ${
      isMissingField(row, field)
        ? 'border-amber-500/80 bg-amber-500/10 text-amber-200'
        : 'border-white/20 text-white'
    }`

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔍</span> OCR Extraction Review
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            {extractedData?.message || `${rows.length} record(s) extracted`} · Method:{' '}
            <span className="text-primary-400 font-mono">{extractedData?.extractionMethod || 'ocr'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onDiscard} className="btn-secondary text-sm">
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>✅ Save All ({rows.length})</>
            )}
          </button>
        </div>
      </div>

      {/* Missing fields warning banner */}
      {hasMissing && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-400 text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">
              {missingCount} record{missingCount > 1 ? 's have' : ' has'} missing fields
            </p>
            <p className="text-amber-200/60 text-xs mt-0.5">
              Cells highlighted in amber are incomplete. Please fill them in before saving, or remove the row.
              You can still save with missing data — the admin can edit later.
            </p>
            {extractedData?.missingSummary && (
              <p className="text-amber-200/50 text-xs mt-1 font-mono">{extractedData.missingSummary}</p>
            )}
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
          ⚠️ {saveError}
        </div>
      )}

      {/* Review Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm text-left min-w-[700px]">
          <thead>
            <tr className="bg-white/5 text-white/60 font-medium text-xs uppercase tracking-wide">
              <th className="px-3 py-3 w-10">#</th>
              <th className="px-3 py-3">Reg. No. {isMissingAny(rows, 'regNo') && <span className="text-amber-400">⚠</span>}</th>
              <th className="px-3 py-3">Name {isMissingAny(rows, 'name') && <span className="text-amber-400">⚠</span>}</th>
              <th className="px-3 py-3">Dept {isMissingAny(rows, 'dept') && <span className="text-amber-400">⚠</span>}</th>
              <th className="px-3 py-3 w-20">Year</th>
              <th className="px-3 py-3 w-24">Marks</th>
              <th className="px-3 py-3 w-16 text-right">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row, idx) => (
              <tr
                key={row._id}
                className={`transition-colors ${
                  row.requiresReview || (row.missingFields && row.missingFields.length > 0)
                    ? 'bg-amber-500/5 hover:bg-amber-500/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <td className="px-3 py-2 text-white/40 text-xs">{idx + 1}</td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.regNo || ''}
                    onChange={e => updateRow(row._id, 'regNo', e.target.value)}
                    className={cellCls(row, 'regNo')}
                    placeholder={isMissingField(row, 'regNo') ? '⚠ Required' : ''}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.name || ''}
                    onChange={e => updateRow(row._id, 'name', e.target.value)}
                    className={cellCls(row, 'name')}
                    placeholder={isMissingField(row, 'name') ? '⚠ Required' : ''}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={row.dept || ''}
                    onChange={e => updateRow(row._id, 'dept', e.target.value)}
                    className={cellCls(row, 'dept')}
                    placeholder={isMissingField(row, 'dept') ? '⚠ Required' : ''}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="1" max="4"
                    value={row.year || ''}
                    onChange={e => updateRow(row._id, 'year', parseInt(e.target.value) || 1)}
                    className={cellCls(row, 'year')}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    value={row.marks ?? ''}
                    onChange={e => updateRow(row._id, 'marks', parseFloat(e.target.value) || 0)}
                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full text-white"
                    placeholder="—"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => removeRow(row._id)}
                    className="text-red-400/60 hover:text-red-400 transition-colors text-base"
                    title="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/30 text-right">
        Tip: Edit any cell inline. Amber cells are OCR gaps — fill them before saving.
      </p>
    </div>
  )
}

function isMissingAny(rows, field) {
  return rows.some(r => r.missingFields && r.missingFields.includes(field))
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────
function StudentUploadZone({ onCsvFile, onPdfFile, isProcessingPdf, error }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadMode, setUploadMode] = useState('csv') // 'csv' | 'pdf'
  const csvRef = useRef(null)
  const pdfRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.csv')) {
      setUploadMode('csv')
      onCsvFile(file)
    } else if (file.name.toLowerCase().endsWith('.pdf')) {
      setUploadMode('pdf')
      onPdfFile(file)
    } else {
      // Let the parent handle the error
      onCsvFile(file)
    }
  }

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit">
        <button
          onClick={() => setUploadMode('csv')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            uploadMode === 'csv'
              ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          📄 CSV Upload
        </button>
        <button
          onClick={() => setUploadMode('pdf')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            uploadMode === 'pdf'
              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          🔍 PDF / OCR Upload
        </button>
      </div>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer ${
          isDragOver
            ? 'border-primary-400 bg-primary-500/10 scale-[1.02]'
            : uploadMode === 'pdf'
            ? 'border-orange-500/30 hover:border-orange-400/60 hover:bg-orange-500/5'
            : 'border-white/20 hover:border-primary-400/50 hover:bg-white/5'
        }`}
        onClick={() => (uploadMode === 'pdf' ? pdfRef.current?.click() : csvRef.current?.click())}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={csvRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={e => onCsvFile(e.target.files[0])}
        />
        <input
          ref={pdfRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => onPdfFile(e.target.files[0])}
        />

        {isProcessingPdf ? (
          <div className="space-y-3 py-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <svg className="animate-spin w-8 h-8 text-orange-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-orange-300 font-semibold">Running Tesseract OCR…</p>
            <p className="text-white/40 text-xs">Extracting student records from PDF — this may take a moment</p>
          </div>
        ) : uploadMode === 'pdf' ? (
          <div className="space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Drop PDF here or click to browse</p>
              <p className="text-sm text-white/40 mt-1">
                Tesseract OCR will extract student records automatically
              </p>
              <p className="text-xs text-white/30 mt-1">
                Supports nominal rolls, transcript PDFs · Max 20 MB · Scanned / image PDFs supported
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
              Tesseract OCR Active
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Drop CSV file here or click to browse</p>
              <p className="text-sm text-white/40 mt-1">
                Required headers:{' '}
                <span className="text-primary-400 font-mono">S. No., Reg. no., Name, Dept, Year</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-3">
          ⚠️ {error}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentDatabasePage() {
  const { students, addStudents, removeStudent, updateStudent, clearStudents, addSavedEntriesToTimetable } = useAdmin()
  const [activeSubTab, setActiveSubTab] = useState('students')
  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [error, setError] = useState(null)

  // OCR / PDF extraction states
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [extractedData, setExtractedData] = useState(null)   // full API response
  const [showReviewPanel, setShowReviewPanel] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null)

  // Timetable OCR States (Subjects Tab)
  const [showTimetableOcr, setShowTimetableOcr] = useState(false)
  const [isExtractingTimetable, setIsExtractingTimetable] = useState(false)
  const [extractedTimetable, setExtractedTimetable] = useState([])
  const [timetableOcrError, setTimetableOcrError] = useState(null)
  const [isSavingTimetable, setIsSavingTimetable] = useState(false)
  const timetablePdfRef = useRef(null)

  // "Add more" refs
  const addMoreCsvRef = useRef(null)
  const addMorePdfRef = useRef(null)

  // Master Data States
  const [halls, setHalls] = useState([])
  const [depts, setDepts] = useState([])
  const [semesters, setSemesters] = useState([])
  const [subjects, setSubjects] = useState([])
  const [invigilators, setInvigilators] = useState([])

  // Form states for CRUD
  const [showHallForm, setShowHallForm] = useState(false)
  const [hallForm, setHallForm] = useState({ hallName: '', rowsCount: 8, columnsCount: 8, seatsPerTable: 1, blockedSeats: '', accessibilitySeats: '', seatingModes: 'semester,internal', allowedExamTypes: 'Internal Examination,University Examination' })
  const [editingHallId, setEditingHallId] = useState(null)

  const [showDeptForm, setShowDeptForm] = useState(false)
  const [deptForm, setDeptForm] = useState({ departmentCode: '', departmentName: '', program: 'B.E.', regulations: '2021', active: true })
  const [editingDeptId, setEditingDeptId] = useState(null)

  const [showSemForm, setShowSemForm] = useState(false)
  const [semForm, setSemForm] = useState({ semesterNumber: 1, academicYear: '2025-26', regulation: '2021', departmentCode: 'CSE' })
  const [editingSemId, setEditingSemId] = useState(null)

  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ subjectCode: '', subjectName: '', departmentCode: 'CSE', semester: 1, regulation: '2021', examType: 'University Examination', active: true })
  const [editingSubjectId, setEditingSubjectId] = useState(null)

  const [showInvigilatorForm, setShowInvigilatorForm] = useState(false)
  const [invigilatorForm, setInvigilatorForm] = useState({ name: '', email: '', departmentCode: 'CSE', availabilityStatus: 'Available', maxWorkloadHours: 12 })
  const [editingInvigId, setEditingInvigId] = useState(null)

  useEffect(() => {
    fetchMasterData()
  }, [])

  async function fetchMasterData() {
    try {
      const [hRes, dRes, semRes, subRes, iRes] = await Promise.all([
        fetch('/api/halls'),
        fetch('/api/departments'),
        fetch('/api/semesters'),
        fetch('/api/subjects'),
        fetch('/api/invigilators'),
      ])
      if (hRes.ok) setHalls(await hRes.json())
      if (dRes.ok) setDepts(await dRes.json())
      if (semRes.ok) setSemesters(await semRes.json())
      if (subRes.ok) setSubjects(await subRes.json())
      if (iRes.ok) setInvigilators(await iRes.json())
    } catch (err) {
      console.error('Error fetching master data:', err)
    }
  }

  // ── CSV handler ──
  function handleCsvFile(file) {
    if (!file) return
    setError(null)
    setSaveSuccessMsg(null)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const newStudents = parseCSV(e.target.result)
        if (newStudents.length === 0) {
          setError('No valid student records found in CSV.')
          return
        }
        const regNos = new Set()
        const validated = newStudents.map(s => {
          if (regNos.has(s.regNo)) throw new Error(`Duplicate Register Number: ${s.regNo}`)
          regNos.add(s.regNo)
          if (!s.dept || s.dept === 'Unknown') throw new Error(`Missing department for ${s.name}`)
          return s
        })
        addStudents(validated)
        setSaveSuccessMsg(`✅ ${validated.length} student(s) loaded from CSV.`)
      } catch (err) {
        setError(err.message)
      }
    }
    reader.readAsText(file)
  }

  // ── PDF / OCR handler ──
  async function handlePdfFile(file) {
    if (!file) return
    setError(null)
    setSaveSuccessMsg(null)
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a .pdf file')
      return
    }
    setIsProcessingPdf(true)
    setShowReviewPanel(false)
    setExtractedData(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/students/extract-pdf', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'OCR extraction failed')
        return
      }
      if (!data.students || data.students.length === 0) {
        setError('No student records could be extracted from this PDF. Please check the file and try again, or use CSV upload.')
        return
      }
      setExtractedData(data)
      setShowReviewPanel(true)
    } catch (e) {
      setError('OCR extraction failed: ' + e.message)
    } finally {
      setIsProcessingPdf(false)
    }
  }

  // ── After admin reviews and clicks "Save All" ──
  function handleOcrSave(editedRows, apiResponse) {
    // Convert OCR rows to the app's student format
    const mapped = editedRows.map((r, i) => ({
      sno: r.sno || i + 1,
      regNo: r.regNo,
      name: r.name,
      dept: r.dept,
      year: r.year || 1,
      marks: r.marks ?? null,
    }))
    addStudents(mapped)
    setShowReviewPanel(false)
    setExtractedData(null)
    setSaveSuccessMsg(`✅ ${mapped.length} student(s) saved from OCR extraction.`)
    // Warn if still missing fields
    const stillMissing = editedRows.filter(r => r.requiresReview || (r.missingFields && r.missingFields.length > 0))
    if (stillMissing.length > 0) {
      setSaveSuccessMsg(prev =>
        (prev || '') + ` ⚠️ ${stillMissing.length} record(s) have missing data — please edit them in the table below.`
      )
    }
  }

  function handleOcrDiscard() {
    setShowReviewPanel(false)
    setExtractedData(null)
    setError(null)
  }

  // Add-more PDF (after students already loaded)
  async function handleAddMorePdf(file) {
    if (!file) return
    setError(null)
    setIsProcessingPdf(true)
    setShowReviewPanel(false)
    setExtractedData(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/students/extract-pdf', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'OCR extraction failed'); return }
      if (!data.students || data.students.length === 0) { setError('No records extracted.'); return }
      setExtractedData(data)
      setShowReviewPanel(true)
    } catch (e) {
      setError('OCR extraction failed: ' + e.message)
    } finally {
      setIsProcessingPdf(false)
    }
  }

  function handleLoadSample() {
    const sample = generateSampleData(112)
    addStudents(sample)
    setSaveSuccessMsg('✅ Sample data loaded (112 students).')
  }

  // ── Timetable OCR Import Handlers (for Subjects tab) ──
  async function handleTimetablePdf(file) {
    if (!file) return
    setTimetableOcrError(null)
    setIsExtractingTimetable(true)
    setExtractedTimetable([])
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/timetable/extract', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setTimetableOcrError(data.message || data.error || 'Failed to extract timetable via OCR')
        return
      }
      const rawEntries = data.entries || data || []
      if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
        setTimetableOcrError('No timetable exam entries could be detected in this PDF.')
        return
      }
      setExtractedTimetable(rawEntries.map((e, idx) => ({
        _key: idx,
        examDate: e.examDate || e.date || '',
        session: (e.session || 'FN').toUpperCase(),
        department: (e.department || 'CSE').toUpperCase(),
        year: e.year || 1,
        courseCode: (e.courseCode || '').toUpperCase(),
        subject: e.subject || '',
        examType: e.examType || 'University Examination'
      })))
      setShowTimetableOcr(true)
    } catch (err) {
      setTimetableOcrError('OCR Extraction failed: ' + err.message)
    } finally {
      setIsExtractingTimetable(false)
    }
  }

  function updateTimetableRow(idx, field, value) {
    setExtractedTimetable(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  function deleteTimetableRow(idx) {
    setExtractedTimetable(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSaveExtractedTimetable() {
    if (extractedTimetable.length === 0) return
    setIsSavingTimetable(true)
    setTimetableOcrError(null)
    try {
      // 1. Extract distinct subjects and save any missing ones to /api/subjects
      const existingCodes = new Set(subjects.map(s => (s.subjectCode || '').toUpperCase()))
      const distinctSubjects = []
      const seen = new Set()

      for (const entry of extractedTimetable) {
        const code = (entry.courseCode || '').trim().toUpperCase()
        if (code && !seen.has(code) && !existingCodes.has(code)) {
          seen.add(code)
          distinctSubjects.push({
            subjectCode: code,
            subjectName: entry.subject || code,
            departmentCode: entry.department || 'CSE',
            semester: entry.year ? entry.year * 2 : 1,
            regulation: '2021',
            examType: entry.examType || 'University Examination',
            active: true
          })
        }
      }

      // Save each new subject
      for (const sub of distinctSubjects) {
        try {
          await fetch('/api/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
          })
        } catch (e) {
          console.warn('Could not auto-save subject:', sub.subjectCode, e)
        }
      }

      // 2. Save full exam timetable sessions to /api/timetable/confirm
      const timetablePayload = extractedTimetable.map(e => ({
        department: e.department,
        year: e.year || 1,
        courseCode: e.courseCode,
        subject: e.subject,
        examDate: e.examDate,
        session: e.session
      }))

      const ttRes = await fetch('/api/timetable/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timetablePayload)
      })

      if (!ttRes.ok) {
        const errData = await ttRes.json().catch(() => ({}))
        throw new Error(errData.message || 'Failed to save timetable schedule')
      }

      // Update in-memory AdminContext timetable state
      if (addSavedEntriesToTimetable) {
        addSavedEntriesToTimetable(timetablePayload)
      }

      // Refresh master data
      await fetchMasterData()

      setShowTimetableOcr(false)
      setExtractedTimetable([])
      setSaveSuccessMsg(`✅ Saved ${distinctSubjects.length} new subjects and ${timetablePayload.length} scheduled exam sessions from OCR!`)
    } catch (err) {
      setTimetableOcrError('Failed to save: ' + err.message)
    } finally {
      setIsSavingTimetable(false)
    }
  }

  // Hall layout grid click
  function handleSeatClick(r, c) {
    const key = `${r}-${c}`
    let blocked = hallForm.blockedSeats ? hallForm.blockedSeats.split(',').map(s => s.trim()) : []
    let accessibility = hallForm.accessibilitySeats ? hallForm.accessibilitySeats.split(',').map(s => s.trim()) : []
    const isBlocked = blocked.includes(key)
    const isAccess = accessibility.includes(key)
    if (!isBlocked && !isAccess) blocked.push(key)
    else if (isBlocked) { blocked = blocked.filter(k => k !== key); accessibility.push(key) }
    else accessibility = accessibility.filter(k => k !== key)
    setHallForm({ ...hallForm, blockedSeats: blocked.filter(Boolean).join(','), accessibilitySeats: accessibility.filter(Boolean).join(',') })
  }

  // Hall CRUD
  async function handleSaveHall(e) {
    e.preventDefault()
    const method = editingHallId ? 'PUT' : 'POST'
    const url = editingHallId ? `/api/halls/${editingHallId}` : '/api/halls'
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitizeObject(hallForm)) })
    if (response.ok) { fetchMasterData(); setShowHallForm(false); setEditingHallId(null); setHallForm({ hallName: '', rowsCount: 8, columnsCount: 8, seatsPerTable: 1, blockedSeats: '', accessibilitySeats: '', seatingModes: 'semester,internal', allowedExamTypes: 'Internal Examination,University Examination' }) }
  }
  function handleEditHall(h) { setEditingHallId(h.id); setHallForm({ ...h }); setShowHallForm(true) }
  async function handleDeleteHall(id) { if (confirm('Delete this exam hall layout?')) { const r = await fetch(`/api/halls/${id}`, { method: 'DELETE' }); if (r.ok) fetchMasterData() } }

  // Dept CRUD
  async function handleSaveDept(e) {
    e.preventDefault()
    const method = editingDeptId ? 'PUT' : 'POST'
    const url = editingDeptId ? `/api/departments/${editingDeptId}` : '/api/departments'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitizeObject(deptForm)) })
    if (r.ok) { fetchMasterData(); setShowDeptForm(false); setEditingDeptId(null); setDeptForm({ departmentCode: '', departmentName: '', program: 'B.E.', regulations: '2021', active: true }) }
  }
  function handleEditDept(d) { setEditingDeptId(d.id); setDeptForm({ ...d }); setShowDeptForm(true) }
  async function handleDeleteDept(id) { if (confirm('Delete department?')) { const r = await fetch(`/api/departments/${id}`, { method: 'DELETE' }); if (r.ok) fetchMasterData() } }

  // Semester CRUD
  async function handleSaveSem(e) {
    e.preventDefault()
    const method = editingSemId ? 'PUT' : 'POST'
    const url = editingSemId ? `/api/semesters/${editingSemId}` : '/api/semesters'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitizeObject(semForm)) })
    if (r.ok) { fetchMasterData(); setShowSemForm(false); setEditingSemId(null); setSemForm({ semesterNumber: 1, academicYear: '2025-26', regulation: '2021', departmentCode: depts[0]?.departmentCode || 'CSE' }) }
  }
  function handleEditSem(s) { setEditingSemId(s.id); setSemForm({ ...s }); setShowSemForm(true) }
  async function handleDeleteSem(id) { if (confirm('Delete semester?')) { const r = await fetch(`/api/semesters/${id}`, { method: 'DELETE' }); if (r.ok) fetchMasterData() } }

  // Subject CRUD
  async function handleSaveSubject(e) {
    e.preventDefault()
    const method = editingSubjectId ? 'PUT' : 'POST'
    const url = editingSubjectId ? `/api/subjects/${editingSubjectId}` : '/api/subjects'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitizeObject(subjectForm)) })
    if (r.ok) { fetchMasterData(); setShowSubjectForm(false); setEditingSubjectId(null); setSubjectForm({ subjectCode: '', subjectName: '', departmentCode: depts[0]?.departmentCode || 'CSE', semester: 1, regulation: '2021', examType: 'University Examination', active: true }) }
  }
  function handleEditSubject(s) { setEditingSubjectId(s.id); setSubjectForm({ ...s }); setShowSubjectForm(true) }
  async function handleDeleteSubject(id) { if (confirm('Delete subject paper?')) { const r = await fetch(`/api/subjects/${id}`, { method: 'DELETE' }); if (r.ok) fetchMasterData() } }

  // Invigilator CRUD
  async function handleSaveInvigilator(e) {
    e.preventDefault()
    const method = editingInvigId ? 'PUT' : 'POST'
    const url = editingInvigId ? `/api/invigilators/${editingInvigId}` : '/api/invigilators'
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sanitizeObject(invigilatorForm)) })
    if (r.ok) { fetchMasterData(); setShowInvigilatorForm(false); setEditingInvigId(null); setInvigilatorForm({ name: '', email: '', departmentCode: depts[0]?.departmentCode || 'CSE', availabilityStatus: 'Available', maxWorkloadHours: 12 }) }
  }
  function handleEditInvig(i) { setEditingInvigId(i.id); setInvigilatorForm({ ...i }); setShowInvigilatorForm(true) }
  async function handleDeleteInvig(id) { if (confirm('Delete invigilator?')) { const r = await fetch(`/api/invigilators/${id}`, { method: 'DELETE' }); if (r.ok) fetchMasterData() } }

  const uniqueDepts = [...new Set(students.map(s => s.dept))]

  return (
    <div className="space-y-6">
      {/* Sub tabs */}
      <div className="flex gap-2 border-b border-white/10 overflow-x-auto pb-2">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeSubTab === tab.id
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ─── STUDENTS TAB ─── */}
      {activeSubTab === 'students' && (
        <div className="space-y-6">

          {/* Success message banner */}
          {saveSuccessMsg && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-green-300 text-sm flex items-center justify-between gap-3">
              <span>{saveSuccessMsg}</span>
              <button onClick={() => setSaveSuccessMsg(null)} className="text-green-400/50 hover:text-green-400 text-lg leading-none">×</button>
            </div>
          )}

          {/* OCR Review Panel (shown after PDF extraction, before final save) */}
          {showReviewPanel && extractedData && (
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
              <OcrReviewPanel
                extractedData={extractedData}
                onSave={handleOcrSave}
                onDiscard={handleOcrDiscard}
              />
            </div>
          )}

          {/* Upload zone (shown when no students yet, or no review panel open) */}
          {students.length === 0 && !showReviewPanel && (
            <div className="space-y-4">
              <StudentUploadZone
                onCsvFile={handleCsvFile}
                onPdfFile={handlePdfFile}
                isProcessingPdf={isProcessingPdf}
                error={error}
              />
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-sm">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <button
                onClick={handleLoadSample}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                Load Sample Data (112 Students)
              </button>
            </div>
          )}

          {/* Error shown outside the upload zone too */}
          {error && students.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center justify-between gap-3">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-lg">×</button>
            </div>
          )}

          {/* Students table */}
          {students.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="badge bg-primary-500/20 text-primary-300 text-lg px-4 py-2">
                    {students.length} Students
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {uniqueDepts.map((dept, i) => (
                      <span key={dept} className={`badge bg-gradient-to-r ${DEPT_COLORS[i % DEPT_COLORS.length]} text-white`}>
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  {/* Add more via CSV */}
                  <button
                    onClick={() => addMoreCsvRef.current?.click()}
                    className="btn-secondary flex items-center gap-2 text-sm"
                    title="Add more students from CSV"
                  >
                    📄 Add CSV
                  </button>
                  <input
                    ref={addMoreCsvRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => handleCsvFile(e.target.files[0])}
                  />
                  {/* Add more via PDF / OCR */}
                  <button
                    onClick={() => addMorePdfRef.current?.click()}
                    disabled={isProcessingPdf}
                    className="btn-secondary flex items-center gap-2 text-sm text-orange-300 border-orange-500/20 hover:bg-orange-500/10 disabled:opacity-50"
                    title="Add more students from PDF using OCR"
                  >
                    {isProcessingPdf ? (
                      <>
                        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        OCR…
                      </>
                    ) : (
                      <>🔍 Add PDF</>
                    )}
                  </button>
                  <input
                    ref={addMorePdfRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={e => handleAddMorePdf(e.target.files[0])}
                  />
                  <button onClick={clearStudents} className="btn-secondary text-red-400 border-red-500/20 hover:bg-red-500/10 text-sm">
                    Clear All
                  </button>
                </div>
              </div>

              {/* Missing-fields persistent warning (after save with gaps) */}
              {students.some(s => s._hasMissing) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-3">
                  ⚠️ Some student records have missing data. Click <strong>Edit</strong> on the row to complete them.
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="bg-white/5 text-white/60 font-medium">
                      <th className="px-4 py-3">S.No.</th>
                      <th className="px-4 py-3">Reg. No.</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Dept</th>
                      <th className="px-4 py-3">Year</th>
                      <th className="px-4 py-3">Marks</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map((s, i) => (
                      <tr
                        key={s.regNo}
                        className={`transition-colors ${
                          s._hasMissing ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-white/5'
                        }`}
                      >
                        {editingStudent === s.regNo ? (
                          <>
                            <td className="px-4 py-2">{s.sno || i + 1}</td>
                            <td className="px-4 py-2">
                              <input type="text" value={editForm.regNo || ''} onChange={e => setEditForm({ ...editForm, regNo: e.target.value })} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={editForm.dept || ''} onChange={e => setEditForm({ ...editForm, dept: e.target.value })} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-full" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" value={editForm.year || ''} onChange={e => setEditForm({ ...editForm, year: parseInt(e.target.value) || 1 })} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-20" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" value={editForm.marks ?? ''} onChange={e => setEditForm({ ...editForm, marks: parseFloat(e.target.value) || 0 })} className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm w-20" />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => { updateStudent(editingStudent, editForm); setEditingStudent(null) }} className="text-green-400 hover:text-green-300 mr-2">Save</button>
                              <button onClick={() => setEditingStudent(null)} className="text-white/40 hover:text-white/60">Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-white/70">{s.sno || i + 1}</td>
                            <td className="px-4 py-3 text-white/70 font-mono">{s.regNo || <span className="text-amber-400">⚠ Missing</span>}</td>
                            <td className="px-4 py-3 text-white">{s.name || <span className="text-amber-400">⚠ Missing</span>}</td>
                            <td className="px-4 py-3">
                              {s.dept
                                ? <span className={`badge bg-gradient-to-r ${DEPT_COLORS[uniqueDepts.indexOf(s.dept) % DEPT_COLORS.length]} text-white`}>{s.dept}</span>
                                : <span className="text-amber-400 text-xs">⚠ Missing</span>}
                            </td>
                            <td className="px-4 py-3 text-white/70">{s.year || <span className="text-amber-400">⚠</span>}</td>
                            <td className="px-4 py-3 text-white/70">{s.marks != null ? s.marks : '—'}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => { setEditingStudent(s.regNo); setEditForm({ ...s }) }} className="text-primary-400 hover:text-primary-300 mr-3">Edit</button>
                              <button onClick={() => removeStudent(s.regNo)} className="text-red-400 hover:text-red-300">Delete</button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── HALLS TAB ─── */}
      {activeSubTab === 'halls' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Configure Examination Halls</h3>
            {!showHallForm && <button onClick={() => setShowHallForm(true)} className="btn-primary">Add Exam Hall</button>}
          </div>
          {showHallForm && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
              <h4 className="font-bold text-md">{editingHallId ? 'Edit Hall Layout' : 'Define New Exam Hall'}</h4>
              <form onSubmit={handleSaveHall} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1">Hall Name/No</label>
                  <input type="text" value={hallForm.hallName} onChange={e => setHallForm({ ...hallForm, hallName: e.target.value })} className="input-field w-full" placeholder="e.g. LH-101" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1">Rows Count</label>
                  <input type="number" min="1" max="20" value={hallForm.rowsCount} onChange={e => setHallForm({ ...hallForm, rowsCount: parseInt(e.target.value) || 8 })} className="input-field w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1">Columns Count</label>
                  <input type="number" min="1" max="20" value={hallForm.columnsCount} onChange={e => setHallForm({ ...hallForm, columnsCount: parseInt(e.target.value) || 4 })} className="input-field w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1">Seats/Table</label>
                  <select value={hallForm.seatsPerTable} onChange={e => setHallForm({ ...hallForm, seatsPerTable: parseInt(e.target.value) || 1 })} className="input-field w-full">
                    <option value="1">1 student per table (Mode A)</option>
                    <option value="2">2 students per table (Mode B)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1">Usable Seating Modes</label>
                  <input type="text" value={hallForm.seatingModes} onChange={e => setHallForm({ ...hallForm, seatingModes: e.target.value })} className="input-field w-full" placeholder="semester,internal" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1">Allowed Exam Types</label>
                  <input type="text" value={hallForm.allowedExamTypes} onChange={e => setHallForm({ ...hallForm, allowedExamTypes: e.target.value })} className="input-field w-full" placeholder="e.g., CIA, End Sem" required />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <label className="block text-xs font-bold text-white/40">Visual Grid Map (Click cells to toggle status)</label>
                  <p className="text-[10px] text-white/30 mb-2">Cycle: Default (Green) → Blocked (Red) → Accessibility (Blue)</p>
                  <div className="inline-block bg-black/20 border border-white/10 rounded-xl p-4 overflow-auto max-w-full">
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${hallForm.columnsCount || 4}, minmax(0, 1fr))` }}>
                      {Array.from({ length: hallForm.rowsCount || 8 }).map((_, r) =>
                        Array.from({ length: hallForm.columnsCount || 4 }).map((_, c) => {
                          const key = `${r}-${c}`
                          const isBlocked = hallForm.blockedSeats?.split(',').includes(key)
                          const isAccess = hallForm.accessibilitySeats?.split(',').includes(key)
                          let bg = 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30'
                          if (isBlocked) bg = 'bg-red-500/30 border-red-500/50 hover:bg-red-500/40'
                          if (isAccess) bg = 'bg-blue-500/30 border-blue-500/50 hover:bg-blue-500/40'
                          return (
                            <button key={key} type="button" onClick={() => handleSeatClick(r, c)} className={`w-10 h-10 border rounded-lg text-[9px] font-mono flex items-center justify-center transition-all ${bg}`}>
                              {r},{c}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-3 flex gap-3 justify-end border-t border-white/10 pt-4">
                  <button type="button" onClick={() => { setShowHallForm(false); setEditingHallId(null) }} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save Layout</button>
                </div>
              </form>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {halls.map(h => (
              <div key={h.id} className="glass-card p-5 border border-white/10 rounded-2xl flex flex-col justify-between hover:border-primary-500/30 transition-all">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-lg text-white">{h.hallName}</h4>
                    <span className="badge bg-primary-500/20 text-primary-300">{h.rowsCount} x {h.columnsCount} Layout</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/40">
                    <div><span>Seats/Table:</span> <span className="text-white/80 font-bold">{h.seatsPerTable}</span></div>
                    <div><span>Blocked Seats:</span> <span className="text-red-400 font-bold">{h.blockedSeats ? h.blockedSeats.split(',').length : 0}</span></div>
                    <div><span>Accessibility Seats:</span> <span className="text-blue-400 font-bold">{h.accessibilitySeats ? h.accessibilitySeats.split(',').length : 0}</span></div>
                    <div><span>Allowed Exams:</span> <span className="text-white/80 truncate max-w-[120px] block">{h.allowedExamTypes || 'All'}</span></div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6 border-t border-white/5 pt-3">
                  <button onClick={() => handleEditHall(h)} className="text-xs text-primary-400 font-bold hover:text-primary-300">Edit</button>
                  <button onClick={() => handleDeleteHall(h.id)} className="text-xs text-red-400 font-bold hover:text-red-300">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── DEPARTMENTS TAB ─── */}
      {activeSubTab === 'departments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Manage Departments</h3>
            {!showDeptForm && <button onClick={() => setShowDeptForm(true)} className="btn-primary">Add Department</button>}
          </div>
          {showDeptForm && (
            <form onSubmit={handleSaveDept} className="bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input type="text" placeholder="Dept Code (e.g. CSE)" value={deptForm.departmentCode} onChange={e => setDeptForm({ ...deptForm, departmentCode: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Dept Name" value={deptForm.departmentName} onChange={e => setDeptForm({ ...deptForm, departmentName: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Program (B.E., B.Tech)" value={deptForm.program} onChange={e => setDeptForm({ ...deptForm, program: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Regulation" value={deptForm.regulations} onChange={e => setDeptForm({ ...deptForm, regulations: e.target.value })} className="input-field" required />
              <div className="flex items-center gap-4 md:col-span-2">
                <button type="button" onClick={() => { setShowDeptForm(false); setEditingDeptId(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          )}
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-white/5 text-white/60"><th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Regulation</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {depts.map(d => (
                  <tr key={d.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-bold text-primary-400">{d.departmentCode}</td>
                    <td className="px-4 py-3">{d.departmentName}</td>
                    <td className="px-4 py-3">{d.program}</td>
                    <td className="px-4 py-3 text-white/50">{d.regulations}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditDept(d)} className="text-primary-400 hover:text-primary-300 mr-3">Edit</button>
                      <button onClick={() => handleDeleteDept(d.id)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SEMESTERS TAB ─── */}
      {activeSubTab === 'semesters' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Manage Semesters</h3>
            {!showSemForm && <button onClick={() => setShowSemForm(true)} className="btn-primary">Add Semester</button>}
          </div>
          {showSemForm && (
            <form onSubmit={handleSaveSem} className="bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="number" placeholder="Sem Number (1-8)" min="1" max="8" value={semForm.semesterNumber} onChange={e => setSemForm({ ...semForm, semesterNumber: parseInt(e.target.value) || 1 })} className="input-field" required />
              <input type="text" placeholder="Academic Year" value={semForm.academicYear} onChange={e => setSemForm({ ...semForm, academicYear: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Regulation" value={semForm.regulation} onChange={e => setSemForm({ ...semForm, regulation: e.target.value })} className="input-field" required />
              <select value={semForm.departmentCode} onChange={e => setSemForm({ ...semForm, departmentCode: e.target.value })} className="input-field">
                {depts.map(d => <option key={d.id} value={d.departmentCode}>{d.departmentCode}</option>)}
              </select>
              <div className="flex gap-4 md:col-span-4 justify-end">
                <button type="button" onClick={() => { setShowSemForm(false); setEditingSemId(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          )}
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-white/5 text-white/60"><th className="px-4 py-3">Semester</th><th className="px-4 py-3">Dept</th><th className="px-4 py-3">Academic Year</th><th className="px-4 py-3">Regulation</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {semesters.map(s => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-bold">Semester {s.semesterNumber}</td>
                    <td className="px-4 py-3 text-primary-400">{s.departmentCode}</td>
                    <td className="px-4 py-3">{s.academicYear}</td>
                    <td className="px-4 py-3 text-white/50">{s.regulation}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditSem(s)} className="text-primary-400 hover:text-primary-300 mr-3">Edit</button>
                      <button onClick={() => handleDeleteSem(s.id)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── SUBJECTS TAB ─── */}
      {activeSubTab === 'subjects' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Subject Master Library</h3>
              <p className="text-xs text-white/40 mt-0.5">
                Manage all academic subjects, or upload a full timetable PDF using Tesseract OCR to automatically feed subjects & schedules.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowTimetableOcr(true)
                  setTimetableOcrError(null)
                }}
                className="btn-secondary text-primary-300 border-primary-500/30 hover:bg-primary-500/10 flex items-center gap-2 text-sm font-semibold"
              >
                <span>📥</span> Import Timetable (OCR)
              </button>
              <input
                ref={timetablePdfRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleTimetablePdf(e.target.files[0])
                }}
              />
              {!showSubjectForm && (
                <button onClick={() => setShowSubjectForm(true)} className="btn-primary text-sm">
                  Add Paper
                </button>
              )}
            </div>
          </div>

          {/* OCR Timetable Ingestion Modal / Panel */}
          {showTimetableOcr && (
            <div className="bg-white/[0.03] border border-primary-500/30 rounded-2xl p-6 space-y-5 animate-fade-in shadow-2xl relative">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-md flex items-center gap-2">
                    <span>📑</span> Tesseract OCR Timetable Import
                  </h4>
                  <p className="text-xs text-white/40 mt-0.5">
                    Extracts Subject Codes, Titles, Departments, Semesters, Dates & Sessions directly from your schedule PDF.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTimetableOcr(false)
                    setExtractedTimetable([])
                    setTimetableOcrError(null)
                  }}
                  className="text-white/40 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {timetableOcrError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs">
                  ⚠️ {timetableOcrError}
                </div>
              )}

              {/* Upload Dropzone (if not extracted yet) */}
              {extractedTimetable.length === 0 && (
                <div
                  onClick={() => timetablePdfRef.current?.click()}
                  className="border-2 border-dashed border-primary-500/30 hover:border-primary-400 bg-primary-500/5 hover:bg-primary-500/10 rounded-2xl p-8 text-center cursor-pointer transition-all"
                >
                  {isExtractingTimetable ? (
                    <div className="space-y-3 py-4">
                      <div className="w-10 h-10 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-primary-300 font-bold text-sm">Processing with Tesseract OCR...</p>
                      <p className="text-xs text-white/40">Analyzing PDF tables, department codes, dates, and subjects</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center text-2xl">
                        📄
                      </div>
                      <p className="text-white font-semibold text-sm">Click to select or drop Timetable PDF here</p>
                      <p className="text-xs text-white/40">Scanned / image PDFs and digital timetables supported</p>
                      <span className="inline-block px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono">
                        ● Tesseract OCR Ready
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Timetable Review Table */}
              {extractedTimetable.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="badge bg-primary-500/20 text-primary-300 text-sm">
                      {extractedTimetable.length} Exam Sessions Extracted
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => timetablePdfRef.current?.click()}
                        className="btn-secondary text-xs"
                      >
                        Re-upload
                      </button>
                      <button
                        onClick={handleSaveExtractedTimetable}
                        disabled={isSavingTimetable}
                        className="btn-primary text-xs flex items-center gap-2"
                      >
                        {isSavingTimetable ? 'Saving...' : `✅ Save to Subjects & Timetable (${extractedTimetable.length})`}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10 max-h-80 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-white/5 text-white/60 sticky top-0 backdrop-blur-md">
                        <tr>
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5 w-16">Session</th>
                          <th className="px-3 py-2.5 w-20">Dept</th>
                          <th className="px-3 py-2.5 w-16">Year</th>
                          <th className="px-3 py-2.5 w-24">Code</th>
                          <th className="px-3 py-2.5">Subject Title</th>
                          <th className="px-3 py-2.5 w-10 text-right">✕</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {extractedTimetable.map((row, idx) => (
                          <tr key={idx} className="hover:bg-white/5">
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.examDate}
                                onChange={e => updateTimetableRow(idx, 'examDate', e.target.value)}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs w-full text-white"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                value={row.session}
                                onChange={e => updateTimetableRow(idx, 'session', e.target.value)}
                                className="bg-white/10 border border-white/20 rounded px-1.5 py-1 text-xs text-white"
                              >
                                <option value="FN">FN</option>
                                <option value="AN">AN</option>
                              </select>
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.department}
                                onChange={e => updateTimetableRow(idx, 'department', e.target.value.toUpperCase())}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs w-full text-white uppercase"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="number"
                                min="1" max="4"
                                value={row.year}
                                onChange={e => updateTimetableRow(idx, 'year', parseInt(e.target.value) || 1)}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs w-full text-white"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.courseCode}
                                onChange={e => updateTimetableRow(idx, 'courseCode', e.target.value.toUpperCase())}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs w-full font-mono text-primary-300 uppercase"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="text"
                                value={row.subject}
                                onChange={e => updateTimetableRow(idx, 'subject', e.target.value)}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs w-full text-white"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => deleteTimetableRow(idx)}
                                className="text-red-400/60 hover:text-red-400 text-sm"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {showSubjectForm && (
            <form onSubmit={handleSaveSubject} className="bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" placeholder="Subject Code" value={subjectForm.subjectCode} onChange={e => setSubjectForm({ ...subjectForm, subjectCode: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Subject Title" value={subjectForm.subjectName} onChange={e => setSubjectForm({ ...subjectForm, subjectName: e.target.value })} className="input-field" required />
              <select value={subjectForm.departmentCode} onChange={e => setSubjectForm({ ...subjectForm, departmentCode: e.target.value })} className="input-field">
                {depts.map(d => <option key={d.id} value={d.departmentCode}>{d.departmentCode}</option>)}
              </select>
              <input type="number" placeholder="Semester (1-8)" value={subjectForm.semester} onChange={e => setSubjectForm({ ...subjectForm, semester: parseInt(e.target.value) || 1 })} className="input-field" required />
              <input type="text" placeholder="Regulation" value={subjectForm.regulation} onChange={e => setSubjectForm({ ...subjectForm, regulation: e.target.value })} className="input-field" required />
              <input type="text" placeholder="Exam Type" value={subjectForm.examType} onChange={e => setSubjectForm({ ...subjectForm, examType: e.target.value })} className="input-field" required />
              <div className="flex gap-4 md:col-span-3 justify-end">
                <button type="button" onClick={() => { setShowSubjectForm(false); setEditingSubjectId(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Paper</button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-white/5 text-white/60"><th className="px-4 py-3">Code</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Dept / Semester</th><th className="px-4 py-3">Exam Type</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {subjects.map(s => (
                  <tr key={s.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono font-bold text-primary-400">{s.subjectCode}</td>
                    <td className="px-4 py-3 font-bold">{s.subjectName}</td>
                    <td className="px-4 py-3">{s.departmentCode} · Sem {s.semester}</td>
                    <td className="px-4 py-3 text-white/50">{s.examType}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditSubject(s)} className="text-primary-400 hover:text-primary-300 mr-3">Edit</button>
                      <button onClick={() => handleDeleteSubject(s.id)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── INVIGILATORS TAB ─── */}
      {activeSubTab === 'invigilators' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Invigilator Panel</h3>
            {!showInvigilatorForm && <button onClick={() => setShowInvigilatorForm(true)} className="btn-primary">Add Examiner</button>}
          </div>
          {showInvigilatorForm && (
            <form onSubmit={handleSaveInvigilator} className="bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="text" placeholder="Full Name" value={invigilatorForm.name} onChange={e => setInvigilatorForm({ ...invigilatorForm, name: e.target.value })} className="input-field" required />
              <input type="email" placeholder="Email Address" value={invigilatorForm.email} onChange={e => setInvigilatorForm({ ...invigilatorForm, email: e.target.value })} className="input-field" required />
              <select value={invigilatorForm.departmentCode} onChange={e => setInvigilatorForm({ ...invigilatorForm, departmentCode: e.target.value })} className="input-field">
                {depts.map(d => <option key={d.id} value={d.departmentCode}>{d.departmentCode}</option>)}
              </select>
              <select value={invigilatorForm.availabilityStatus} onChange={e => setInvigilatorForm({ ...invigilatorForm, availabilityStatus: e.target.value })} className="input-field">
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
              <input type="number" placeholder="Max Sessions Workload" value={invigilatorForm.maxWorkloadHours} onChange={e => setInvigilatorForm({ ...invigilatorForm, maxWorkloadHours: parseInt(e.target.value) || 12 })} className="input-field" required />
              <div className="flex gap-4 md:col-span-3 justify-end">
                <button type="button" onClick={() => { setShowInvigilatorForm(false); setEditingInvigId(null) }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Examiner</button>
              </div>
            </form>
          )}
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead><tr className="bg-white/5 text-white/60"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Dept</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Workload Limit</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {invigilators.map(inv => (
                  <tr key={inv.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-bold">{inv.name}<span className="block text-xs font-normal text-white/40">{inv.email}</span></td>
                    <td className="px-4 py-3 font-mono">{inv.departmentCode}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${inv.availabilityStatus === 'Available' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{inv.availabilityStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-white/60">{inv.maxWorkloadHours} sessions</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditInvig(inv)} className="text-primary-400 hover:text-primary-300 mr-3">Edit</button>
                      <button onClick={() => handleDeleteInvig(inv.id)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
