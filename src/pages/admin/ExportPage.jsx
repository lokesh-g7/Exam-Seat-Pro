import { useState, useEffect } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { flattenHalls, calculateConflicts, calculateSQI, MODES } from '../../utils/seatingEngine'
import HallGrid from '../../components/HallGrid'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Helper to reconstruct 3D hall grids from flat allocation records if needed
function reconstructGridsFromFlat(flatList) {
  if (!Array.isArray(flatList) || flatList.length === 0) return []
  // If already a valid 3D grid: [ [ [seat, seat] ] ]
  if (Array.isArray(flatList[0]) && Array.isArray(flatList[0][0])) return flatList

  const hallMap = new Map()
  for (const item of flatList) {
    if (!item || typeof item !== 'object') continue
    const h = item.hall || 1
    if (!hallMap.has(h)) hallMap.set(h, [])
    hallMap.get(h).push(item)
  }

  const sortedHalls = Array.from(hallMap.keys()).sort((a, b) => a - b)
  const resultGrids = []

  for (const h of sortedHalls) {
    const items = hallMap.get(h)
    let maxRow = 1
    let maxCol = 1
    for (const it of items) {
      const r = it.seatRow ?? it.row ?? 1
      const c = it.seatCol ?? it.col ?? 1
      if (r > maxRow) maxRow = r
      if (c > maxCol) maxCol = c
    }
    const grid = Array.from({ length: maxRow }, () => Array.from({ length: maxCol }, () => null))
    for (const it of items) {
      const r = (it.seatRow ?? it.row ?? 1) - 1
      const c = (it.seatCol ?? it.col ?? 1) - 1
      if (r >= 0 && r < maxRow && c >= 0 && c < maxCol) {
        grid[r][c] = {
          ...it,
          row: it.seatRow ?? it.row,
          col: it.seatCol ?? it.col,
          year: it.examYear ?? it.year,
        }
      }
    }
    resultGrids.push(grid)
  }

  return resultGrids
}

function isValidGridArray(arr) {
  return Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0]) && Array.isArray(arr[0][0])
}

export default function ExportPage() {
  const { students, timetable, config: adminConfig, seating: localSeating, publishAllocations, isPublishing, publishResult, nextStep } = useAdmin()
  const [isExporting, setIsExporting] = useState(false)
  const [exportType, setExportType] = useState(null) // 'excel' | 'pdf'
  const [exported, setExported] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Single Source of Truth — try to fetch officially published from backend
  const [officialSeating, setOfficialSeating] = useState(null)
  const [isLoadingOfficial, setIsLoadingOfficial] = useState(true)

  useEffect(() => {
    async function fetchPublished() {
      try {
        const res = await fetch('/api/admin/reports/published')
        if (res.ok && res.status !== 204) {
          const data = await res.json()
          if (data && data.length > 0) {
            const latest = data[0]
            if (latest.allocationsJson) {
              const parsed = JSON.parse(latest.allocationsJson)
              const reconstructed = reconstructGridsFromFlat(parsed)
              if (isValidGridArray(reconstructed)) {
                setOfficialSeating(reconstructed)
              }
            }
          }
        }
      } catch {
        // Backend may be offline — silently fall back to local state
      } finally {
        setIsLoadingOfficial(false)
      }
    }
    fetchPublished()
  }, [])

  // Prefer active in-memory seating from Allocation workflow; fall back to official DB seating if memory is empty
  const rawSeating = (isValidGridArray(localSeating) ? localSeating : null) ||
                     (isValidGridArray(officialSeating) ? officialSeating : null) ||
                     (Array.isArray(localSeating) && localSeating.length > 0 ? reconstructGridsFromFlat(localSeating) : [])
  const seating = isValidGridArray(rawSeating) ? rawSeating : []
  const isOfficialPublished = Boolean(officialSeating && isValidGridArray(officialSeating))

  const config = adminConfig || { mode: MODES.SEMESTER }

  const flatSeating = seating.length > 0 ? flattenHalls(seating, config.mode) : []
  const allConflicts = seating.length > 0 ? seating.filter(g => Array.isArray(g) && Array.isArray(g[0])).flatMap(grid => calculateConflicts(grid, config.mode)) : []
  const { sqi, rating } = calculateSQI(allConflicts)
  const conflictCount = allConflicts.length

  async function exportToExcel() {
    setIsExporting(true)
    setExportType('excel')
    await new Promise(resolve => requestAnimationFrame(resolve))

    try {
      const wb = XLSX.utils.book_new()

      // Sheet 1: Seating Arrangement
      const seatingHeaders = ['S.No.', 'Reg. No.', 'Name', 'Department', 'Year', 'Marks', 'Hall', 'Seat No.', 'Row', 'Column']
      const seatingData = [seatingHeaders, ...flatSeating.map((s, i) => [
        s.sno || i + 1, s.regNo, s.name, s.dept, s.year, s.marks != null ? s.marks : '-',
        `Hall ${s.hall}`, s.seat, s.row, s.col
      ])]
      const seatingWs = XLSX.utils.aoa_to_sheet(seatingData)
      // Column widths
      seatingWs['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 5 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 5 }, { wch: 7 }]
      XLSX.utils.book_append_sheet(wb, seatingWs, 'Seating Arrangement')

      // Sheet 2: Hall-wise
      for (let h = 0; h < seating.length; h++) {
        const hallStudents = flatSeating.filter(s => s.hall === h + 1)
        const hallHeaders = ['Seat No.', 'Row', 'Col', 'Reg. No.', 'Name', 'Dept', 'Year']
        const hallData = [hallHeaders, ...hallStudents.map(s => [s.seat, s.row, s.col, s.regNo, s.name, s.dept, s.year])]
        const ws = XLSX.utils.aoa_to_sheet(hallData)
        XLSX.utils.book_append_sheet(wb, ws, `Hall ${h + 1}`)
      }

      // Sheet 3: Students master list
      const studentsHeaders = ['S.No.', 'Reg. No.', 'Name', 'Department', 'Year', 'Marks']
      const studentsData = [studentsHeaders, ...students.map((s, i) => [s.sno || i + 1, s.regNo, s.name, s.dept, s.year, s.marks != null ? s.marks : '-'])]
      const studentsWs = XLSX.utils.aoa_to_sheet(studentsData)
      XLSX.utils.book_append_sheet(wb, studentsWs, 'Students')

      // Sheet 4: Timetable
      if (timetable.length > 0) {
        const ttHeaders = ['Date', 'Session', 'Department', 'Year', 'Course Code', 'Subject']
        const ttData = [ttHeaders, ...timetable.map(t => [t.examDate || t.date, t.session, t.department, t.year, t.courseCode, t.subject])]
        const ttWs = XLSX.utils.aoa_to_sheet(ttData)
        XLSX.utils.book_append_sheet(wb, ttWs, 'Timetable')
      }

      XLSX.writeFile(wb, `ExamSeat_Arrangement_${new Date().toISOString().slice(0, 10)}.xlsx`)
      setExported(true)
    } catch (err) {
      console.error('Excel export error:', err)
      alert('Excel export failed: ' + err.message)
    } finally {
      setIsExporting(false)
      setExportType(null)
    }
  }

  async function exportToPDF() {
    setIsExporting(true)
    setExportType('pdf')
    await new Promise(resolve => requestAnimationFrame(resolve))

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

      // Title page header
      doc.setFillColor(30, 41, 59)
      doc.rect(0, 0, 297, 25, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('ExamSeat Pro — Seating Arrangement', 14, 16)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${today}  |  Mode: ${config.mode === MODES.SEMESTER ? 'Semester' : 'Internal'}  |  Session: ${config.session}  |  Students: ${students.length}  |  Halls: ${seating.length}  |  SQI: ${Math.round(sqi)} (${rating})`, 14, 22)

      // Main seating table
      const tableData = flatSeating.map((s, i) => [
        s.sno || i + 1,
        s.regNo,
        s.name,
        s.dept,
        s.year,
        s.marks != null ? s.marks : '—',
        `Hall ${s.hall}`,
        s.seat,
        s.row,
        s.col,
      ])

      autoTable(doc, {
        startY: 30,
        head: [['S.No.', 'Reg. No.', 'Name', 'Department', 'Year', 'Marks', 'Hall', 'Seat', 'Row', 'Col']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 24 },
          2: { cellWidth: 48 },
          3: { cellWidth: 22 },
          4: { cellWidth: 12 },
          5: { cellWidth: 14 },
          6: { cellWidth: 16 },
          7: { cellWidth: 14 },
          8: { cellWidth: 12 },
          9: { cellWidth: 12 },
        },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        didDrawPage: (data) => {
          // Footer on every page
          doc.setFontSize(7)
          doc.setTextColor(150)
          doc.text(
            `ExamSeat Pro  |  Page ${doc.getCurrentPageInfo().pageNumber}`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 6
          )
        },
      })

      // Hall-wise pages
      for (let h = 0; h < seating.length; h++) {
        doc.addPage('a4', 'landscape')
        doc.setFillColor(30, 41, 59)
        doc.rect(0, 0, 297, 18, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text(`Hall ${h + 1} — Seating Plan`, 14, 12)

        const hallStudents = flatSeating.filter(s => s.hall === h + 1)
        autoTable(doc, {
          startY: 22,
          head: [['Seat', 'Row', 'Col', 'Reg. No.', 'Name', 'Dept', 'Year']],
          body: hallStudents.map(s => [s.seat, s.row, s.col, s.regNo, s.name, s.dept, s.year]),
          theme: 'grid',
          headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
          pageBreak: 'auto',
        })
      }

      doc.save(`ExamSeat_Arrangement_${new Date().toISOString().slice(0, 10)}.pdf`)
      setExported(true)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('PDF export failed: ' + err.message)
    } finally {
      setIsExporting(false)
      setExportType(null)
    }
  }

  async function handleSyncAndNext() {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const result = await publishAllocations()
      if (localSeating && localSeating.length > 0) {
        setOfficialSeating(localSeating)
      }
      setSyncResult({ success: true, message: result?.message || 'Database updated successfully. Students can now view their seat allocations.' })
      setTimeout(() => nextStep(), 1500)
    } catch (err) {
      setSyncResult({ success: false, message: err.message || 'Failed to sync with database.' })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Source-of-truth banner */}
      {isOfficialPublished ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-400 flex items-center gap-2">
          <span>✅</span> Loaded from <strong>officially PUBLISHED</strong> seating in database — exports are authoritative.
        </div>
      ) : (localSeating && localSeating.length > 0) ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-400 flex items-center gap-2">
          <span>⚠️</span> Showing <strong>in-memory seating</strong> (backend offline or not yet published). Publish to database before distributing reports.
        </div>
      ) : null}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-xs uppercase tracking-wider">Students</p>
          <p className="text-2xl font-bold">{students.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-xs uppercase tracking-wider">Halls</p>
          <p className="text-2xl font-bold text-primary-400">{seating.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-xs uppercase tracking-wider">Conflicts</p>
          <p className={`text-2xl font-bold ${conflictCount === 0 ? 'text-green-400' : 'text-red-400'}`}>
            {conflictCount}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-xs uppercase tracking-wider">SQI Score</p>
          <p className={`text-2xl font-bold ${sqi >= 90 ? 'text-green-400' : sqi >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
            {Math.round(sqi)}
            <span className="text-sm text-white/40 ml-1">{rating}</span>
          </p>
        </div>
      </div>

      {/* Conflict advisory — non-blocking */}
      {conflictCount > 0 && (
        <div className={`border rounded-xl p-4 flex items-center gap-3 ${conflictCount <= 5 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <svg className={`w-6 h-6 flex-shrink-0 ${conflictCount <= 5 ? 'text-amber-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1">
            <p className={`font-bold text-sm ${conflictCount <= 5 ? 'text-amber-400' : 'text-red-400'}`}>
              {conflictCount} conflict{conflictCount > 1 ? 's' : ''} detected
              {conflictCount <= 5 ? ' — minor, you can still export & publish' : ' — consider regenerating for best results'}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              {conflictCount <= 5
                ? 'Low conflict count. You may proceed with export and sync, or go back to Allocation and click Regenerate to eliminate them.'
                : `${conflictCount} conflicts found. You can still export now, or go back to Allocation → Regenerate for a cleaner arrangement.`}
            </p>
          </div>
          {conflictCount <= 5 && (
            <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full whitespace-nowrap">OK to Proceed</span>
          )}
        </div>
      )}

      {/* Export Actions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="font-bold text-lg mb-2">Export Final Seating</h3>
        <p className="text-white/40 text-sm mb-4">Download the formatted seating arrangement for distribution to students.</p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={exportToExcel}
            disabled={isExporting || seating.length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting && exportType === 'excel' ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Exporting...</>
            ) : (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Export Excel (.xlsx)</>
            )}
          </button>

          <button
            onClick={exportToPDF}
            disabled={isExporting || seating.length === 0}
            className="btn-secondary flex items-center gap-2 border-red-400/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {isExporting && exportType === 'pdf' ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Exporting...</>
            ) : (
              <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>Export PDF</>
            )}
          </button>
        </div>

        {exported && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Export completed successfully!
          </div>
        )}
      </div>

      {/* Database Sync */}
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582 4 8 4" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-emerald-300 mb-1">Sync to Database & Student Portal</h3>
            <p className="text-white/40 text-sm mb-4">
              Saves all {flatSeating.length} seat allocations to the database. Students can then log in to the Student Portal with their registration number to view their assigned hall and seat number.
            </p>
            <button
              onClick={handleSyncAndNext}
              disabled={isSyncing || seating.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Syncing to Database...</>
              ) : (
                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Publish & Sync to Student Portal</>
              )}
            </button>
            {syncResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${syncResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {syncResult.success ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
                {syncResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Final Preview */}
      {seating.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Final Hall Preview</h3>
            <input
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="space-y-8">
            {seating.map((grid, idx) => {
              if (!Array.isArray(grid) || !Array.isArray(grid[0])) return null
              const seatCount = (typeof grid.flat === 'function' ? grid.flat() : [].concat(...grid)).filter(Boolean).length
              const conflicts = calculateConflicts(grid, config.mode)
              return (
                <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                  <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏛️</span>
                      <span className="font-bold">Hall {idx + 1}</span>
                      <span className="text-white/40 text-sm">{seatCount} students</span>
                    </div>
                    {conflicts.length > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-bold rounded-full">
                        {conflicts.length} conflicts
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <HallGrid
                      grid={grid}
                      hallIndex={idx}
                      examMode={config.mode}
                      searchTerm={searchTerm}
                      highlightConflicts={false}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
