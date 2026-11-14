import { useState, useEffect } from 'react'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Student Reported Issues States
  const [issues, setIssues] = useState([])
  const [isLoadingIssues, setIsLoadingIssues] = useState(true)
  const [issueSearchTerm, setIssueSearchTerm] = useState('')
  const [issueFilter, setIssueFilter] = useState('ALL') // 'ALL', 'OPEN', 'RESOLVED'

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch('/api/admin/audit')
        if (res.ok) {
          const data = await res.json()
          setLogs(data)
        }
      } catch (err) {
        console.error("Failed to fetch audit logs:", err)
      } finally {
        setIsLoading(false)
      }
    }

    async function fetchIssues() {
      try {
        const res = await fetch('/api/issues')
        if (res.ok) {
          const data = await res.json()
          setIssues(data)
        }
      } catch (err) {
        console.error("Failed to fetch student issues:", err)
      } finally {
        setIsLoadingIssues(false)
      }
    }

    fetchLogs()
    fetchIssues()
  }, [])

  async function handleToggleStatus(issueId, currentStatus) {
    const newStatus = currentStatus === 'OPEN' ? 'RESOLVED' : 'OPEN'
    try {
      const res = await fetch(`/api/issues/${issueId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        const updated = await res.json()
        setIssues(prev => prev.map(i => i.id === issueId ? updated : i))
      }
    } catch (err) {
      console.error("Failed to update issue status:", err)
    }
  }

  const filteredLogs = logs.filter(log =>
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.entityType && log.entityType.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const filteredIssues = issues.filter(issue => {
    const matchesFilter =
      issueFilter === 'ALL' ||
      (issue.status || 'OPEN').toUpperCase() === issueFilter

    const q = issueSearchTerm.toLowerCase()
    const matchesSearch =
      (issue.studentName || '').toLowerCase().includes(q) ||
      (issue.regNo || '').toLowerCase().includes(q) ||
      (issue.category || '').toLowerCase().includes(q) ||
      (issue.message || '').toLowerCase().includes(q) ||
      (issue.dept || '').toLowerCase().includes(q)

    return matchesFilter && matchesSearch
  })

  const openIssuesCount = issues.filter(i => (i.status || 'OPEN').toUpperCase() === 'OPEN').length

  return (
    <div className="space-y-8 animate-fade-in text-white">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>🛡️</span> Audit Logs & Issue Center
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Immutable administrative action logs and live student-reported seating inquiries.
          </p>
        </div>
      </div>

      {/* ─── SECTION 1: SYSTEM ACTION & SECURITY LOGS ─── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔒</span> Security & Action Audit
          </h3>
          <input
            type="text"
            placeholder="Search action, user, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-white/50 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-500 mr-3" />
            Loading audit history...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-left text-sm text-white/70">
              <thead className="text-xs text-white/50 uppercase bg-white/5 border-b border-white/5 font-semibold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-white/40">
                      No security audit logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                            {log.username?.charAt(0).toUpperCase() || 'A'}
                          </div>
                          <span className="font-medium text-white">{log.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.entityType ? (
                          <span className="text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded text-xs border border-indigo-500/20">
                            {log.entityType} #{log.entityId}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[200px]" title={log.reason}>
                        {log.reason || '-'}
                      </td>
                      <td className="px-4 py-3 truncate max-w-[250px] text-xs font-mono opacity-60" title={log.details}>
                        {log.details || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: STUDENT REPORTED ISSUES & FEEDBACK ─── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚠️</span> Student Reported Issues & Feedback
              </h3>
              {openIssuesCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono animate-pulse">
                  {openIssuesCount} OPEN
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-1">
              Issues submitted directly by students from their portal regarding exam halls, seat numbers, or physical struggles.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter pills */}
            <div className="flex rounded-lg bg-black/30 p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setIssueFilter('ALL')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  issueFilter === 'ALL' ? 'bg-primary-500 text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                All ({issues.length})
              </button>
              <button
                type="button"
                onClick={() => setIssueFilter('OPEN')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  issueFilter === 'OPEN' ? 'bg-amber-500 text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                Open ({openIssuesCount})
              </button>
              <button
                type="button"
                onClick={() => setIssueFilter('RESOLVED')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  issueFilter === 'RESOLVED' ? 'bg-emerald-500 text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                Resolved ({issues.length - openIssuesCount})
              </button>
            </div>

            <input
              type="text"
              placeholder="Search student, regNo, issue..."
              value={issueSearchTerm}
              onChange={(e) => setIssueSearchTerm(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-full sm:w-60"
            />
          </div>
        </div>

        {isLoadingIssues ? (
          <div className="flex items-center justify-center h-32 text-white/50 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-amber-500 mr-3" />
            Loading student issues...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-left text-sm text-white/70">
              <thead className="text-xs text-white/50 uppercase bg-white/5 border-b border-white/5 font-semibold">
                <tr>
                  <th className="px-4 py-3">Reported At</th>
                  <th className="px-4 py-3">Student Name & Reg No</th>
                  <th className="px-4 py-3">Dept & Year</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Student Message / Struggle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-white/40">
                      No student issues found under this filter.
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => {
                    const isOpen = (issue.status || 'OPEN').toUpperCase() === 'OPEN'

                    return (
                      <tr key={issue.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-white/50">
                          {issue.createdAt ? new Date(issue.createdAt).toLocaleString() : 'Just now'}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          <div>{issue.studentName || 'Student'}</div>
                          <span className="font-mono text-xs text-primary-300">{issue.regNo}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/70">
                          {issue.dept || '—'} · Yr {issue.year || '1'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {issue.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-sm text-xs text-white/90 leading-relaxed">
                          {issue.message}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isOpen ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ● OPEN
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ✓ RESOLVED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(issue.id, issue.status || 'OPEN')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              isOpen
                                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                                : 'bg-white/5 hover:bg-white/10 text-white/50'
                            }`}
                          >
                            {isOpen ? 'Mark as Resolved' : 'Reopen Ticket'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
