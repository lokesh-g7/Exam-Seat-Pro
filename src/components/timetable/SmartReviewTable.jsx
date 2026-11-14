import { useState } from 'react';
import { 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Save, 
  X,
  Info
} from 'lucide-react';
import { useTimetableStore, UPLOAD_STATES } from '../../stores/timetableStore';

const CONFIDENCE_THRESHOLD = 0.8;

function getConfidenceColor(score) {
  if (score >= CONFIDENCE_THRESHOLD) return 'text-emerald-400';
  if (score >= 0.6) return 'text-amber-400';
  return 'text-red-400';
}

function getConfidenceBg(score) {
  if (score >= CONFIDENCE_THRESHOLD) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 0.6) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function EditableCell({ value, onChange, type = 'text', options = [], confidence }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [showTooltip, setShowTooltip] = useState(false);

  const isLowConfidence = confidence !== undefined && confidence < CONFIDENCE_THRESHOLD;
  const needsReview = isLowConfidence;

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        {type === 'select' ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="bg-surface-800 border border-primary-500/50 rounded px-2 py-1 text-white text-sm"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : type === 'number' ? (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="bg-surface-800 border border-primary-500/50 rounded px-2 py-1 text-white text-sm w-20"
            min={1}
            max={4}
          />
        ) : (
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="bg-surface-800 border border-primary-500/50 rounded px-2 py-1 text-white text-sm w-full"
          />
        )}
        <button onClick={handleSave} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded">
          <Save className="w-4 h-4" />
        </button>
        <button onClick={handleCancel} className="p-1 text-red-400 hover:bg-red-500/20 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        className={`
          flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2
          ${needsReview ? 'border border-dashed' : ''}
          ${needsReview ? getConfidenceBg(confidence) : ''}
        `}
        onClick={() => setIsEditing(true)}
        onMouseEnter={() => needsReview && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`${needsReview ? 'text-white font-medium' : 'text-white/90'}`}>
          {value || '—'}
        </span>
        {needsReview && (
          <AlertTriangle className={`w-3 h-3 ${getConfidenceColor(confidence)}`} />
        )}
        <Edit2 className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {showTooltip && needsReview && (
        <div className="absolute z-50 left-0 top-full mt-2 px-3 py-2 bg-surface-800 border border-white/10 
                        rounded-lg shadow-xl max-w-xs text-xs">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-bold mb-1">Low Confidence: {Math.round(confidence * 100)}%</p>
              <p className="text-white/60">This field may need review. Click to edit.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SmartReviewTable({ departments = [], onSaved }) {
  const { 
    parsedEntries, 
    updateEntryField, 
    removeParsedEntry,
    confirmEntries,
    setParsedEntries,
    uploadState,
    setUploadState
  } = useTimetableStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const lowConfidenceCount = parsedEntries.filter(e => 
    e.confidenceScore < CONFIDENCE_THRESHOLD || e.requiresReview
  ).length;

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const savedEntries = await confirmEntries();
      if (onSaved) onSaved(savedEntries);
      setParsedEntries([]);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setParsedEntries([]);
    setUploadState(UPLOAD_STATES.IDLE);
  };

  const handleBulkYear = (year) => {
    const updated = parsedEntries.map(entry => ({
      ...entry,
      year,
    }));
    setParsedEntries(updated);
  };

  const handleBulkSession = (session) => {
    const updated = parsedEntries.map(entry => ({
      ...entry,
      session,
    }));
    setParsedEntries(updated);
  };

  if (!parsedEntries || parsedEntries.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-900 border border-primary-500/30 rounded-3xl p-8 animate-in slide-in-from-top duration-500 
                    shadow-[0_50px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[100px] -mr-32 -mt-32" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`w-2 h-2 rounded-full animate-pulse ${lowConfidenceCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <h3 className="font-black text-2xl text-white tracking-tight">Review Extraction</h3>
            {lowConfidenceCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                {lowConfidenceCount} needs review
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm font-medium">
            {parsedEntries.length} entries extracted • Click any field to edit
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-white/40 text-xs font-medium">Bulk:</span>
            <select
              onChange={(e) => handleBulkYear(parseInt(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              defaultValue=""
            >
              <option value="" disabled>Set Year</option>
              {[1, 2, 3, 4].map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
            <select
              onChange={(e) => handleBulkSession(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              defaultValue=""
            >
              <option value="" disabled>Set Session</option>
              <option value="FN">FN</option>
              <option value="AN">AN</option>
            </select>
          </div>
          
          <button 
            onClick={handleDiscard}
            disabled={isSaving}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-xl 
                       transition-all border border-white/5 disabled:opacity-50"
          >
            Discard
          </button>
          <button 
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold 
                       rounded-xl shadow-[0_15px_30px_rgba(16,185,129,0.3)] hover:shadow-emerald-500/40 
                       transition-all border border-emerald-400/20 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Accept & Save All
              </>
            )}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 text-sm font-medium">{saveError}</span>
        </div>
      )}
      
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md relative z-10 max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-800 z-10">
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-white/30 uppercase tracking-widest text-[10px] font-black w-16">#</th>
              <th className="px-4 py-3 text-left text-white/30 uppercase tracking-widest text-[10px] font-black">Dept</th>
              <th className="px-4 py-3 text-left text-white/30 uppercase tracking-widest text-[10px] font-black">Year</th>
              <th className="px-4 py-3 text-left text-white/30 uppercase tracking-widest text-[10px] font-black">Subject / Course</th>
              <th className="px-4 py-3 text-left text-white/30 uppercase tracking-widest text-[10px] font-black">Exam Date</th>
              <th className="px-4 py-3 text-left text-white/30 uppercase tracking-widest text-[10px] font-black">Slot</th>
              <th className="px-4 py-3 text-center text-white/30 uppercase tracking-widest text-[10px] font-black">Confidence</th>
              <th className="px-4 py-3 text-center text-white/30 uppercase tracking-widest text-[10px] font-black w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {parsedEntries.map((entry, index) => {
              const fieldConfidence = entry.fieldConfidences || {};
              const deptConfidence = fieldConfidence.department || entry.confidenceScore;
              const hasLowConfidence = entry.confidenceScore < CONFIDENCE_THRESHOLD || entry.requiresReview;
              
              return (
<tr 
                   key={entry._key || entry.id} 
                   className={`
                     hover:bg-white/[0.03] transition-colors group
                     ${hasLowConfidence ? 'bg-amber-500/5' : ''}
                   `}
                 >
                  <td className="px-4 py-3 text-white/30 font-mono text-xs">{index + 1}</td>
                  <td className="px-4 py-3">
<EditableCell
                       value={entry.department}
                       onChange={(val) => updateEntryField(entry._key || entry.id, 'department', val)}
                       options={departments.length > 0 ? departments : ['CCE', 'CSE', 'ECE', 'EEE', 'MECH', 'CIVIL']}
                       type="select"
                       confidence={deptConfidence}
                     />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      value={entry.year}
                      onChange={(val) => updateEntryField(entry._key || entry.id, 'year', parseInt(val))}
                      options={[1, 2, 3, 4]}
                      type="number"
                      confidence={fieldConfidence.year || entry.confidenceScore}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <EditableCell
                        value={entry.subject}
                        onChange={(val) => updateEntryField(entry._key || entry.id, 'subject', val)}
                        confidence={fieldConfidence.subject || entry.confidenceScore}
                      />
                      <span className="text-primary-400/60 font-mono text-xs mt-1">
                        <EditableCell
                          value={entry.courseCode}
                          onChange={(val) => updateEntryField(entry._key || entry.id, 'courseCode', val)}
                          confidence={fieldConfidence.courseCode || entry.confidenceScore}
                        />
                      </span>
                      {entry.rawValue && entry.normalizedValue && entry.rawValue !== entry.normalizedValue && (
                        <div className="mt-1">
                          <span className="text-[9px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-sans inline-block">
                            OCR Lookalike Typo: <span className="line-through text-white/40 font-mono">{entry.rawValue}</span> &rarr; <span className="font-bold text-white font-mono">{entry.normalizedValue}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      value={entry.examDate || entry.date}
                      onChange={(val) => updateEntryField(entry._key || entry.id, 'examDate', val)}
                      type="date"
                      confidence={fieldConfidence.date || entry.confidenceScore}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <EditableCell
                      value={entry.session}
                      onChange={(val) => updateEntryField(entry._key || entry.id, 'session', val)}
                      options={['FN', 'AN']}
                      type="select"
                      confidence={fieldConfidence.session || entry.confidenceScore}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className={`
                      inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                      ${getConfidenceColor(entry.confidenceScore)}
                      ${getConfidenceBg(entry.confidenceScore)}
                    `}>
                      {entry.confidenceScore >= CONFIDENCE_THRESHOLD ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      {Math.round(entry.confidenceScore * 100)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => removeParsedEntry(entry._key || entry.id)}
                      className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-white/30">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            High confidence (80%+)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Needs review
          </span>
        </div>
        <span>{parsedEntries.length} entries</span>
      </div>
    </div>
  );
}