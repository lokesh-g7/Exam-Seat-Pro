import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useTimetableStore, UPLOAD_STATES } from '../../stores/timetableStore';

export default function PDFUploadZone({ onUploadComplete }) {
  const { 
    uploadState, 
    progress, 
    error,
    uploadPdf,
    resetState
  } = useTimetableStore();
  
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        alert('File too large. Maximum size is 10MB.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        alert('Invalid file type. Only PDF files are allowed.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      try {
        await uploadPdf(acceptedFiles[0]);
        if (onUploadComplete) onUploadComplete();
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  }, [uploadPdf, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: uploadState === UPLOAD_STATES.UPLOADING || 
               uploadState === UPLOAD_STATES.PARSING,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const isProcessing = uploadState === UPLOAD_STATES.UPLOADING || 
                        uploadState === UPLOAD_STATES.PARSING;

  return (
    <div className="w-full">
      <label 
        {...getRootProps()} 
        className={`
          relative group block cursor-pointer transition-all duration-300
          ${isProcessing ? 'pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className={`
          h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center 
          transition-all backdrop-blur-md overflow-hidden
          ${dragActive || isDragActive 
            ? 'border-primary-500 bg-primary-500/10 scale-[1.02]' 
            : 'border-white/10 bg-white/5 hover:border-primary-500/50 hover:bg-primary-500/5'
          }
          ${error ? 'border-red-500/50 bg-red-500/5' : ''}
          ${uploadState === UPLOAD_STATES.SUCCESS ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
        `}>
          {isProcessing ? (
            <div className="w-full px-12 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                <span className="text-primary-400 font-bold tracking-wide">
                  {uploadState === UPLOAD_STATES.UPLOADING ? 'UPLOADING...' : 'SMART SENSING: ANALYZING...'}
                </span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-white/40 text-xs mt-2 font-medium">{progress}% complete</p>
            </div>
          ) : error ? (
            <div className="text-center px-8">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 font-bold text-sm mb-2">Upload Failed</p>
              <p className="text-white/40 text-xs">{error}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); resetState(); }}
                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 
                         font-bold rounded-lg text-sm transition-all border border-white/5"
              >
                Try Again
              </button>
            </div>
          ) : uploadState === UPLOAD_STATES.SUCCESS ? (
            <div className="text-center px-8">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-emerald-400 font-bold text-sm">Upload Complete!</p>
              <button 
                onClick={(e) => { e.stopPropagation(); resetState(); }}
                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 
                         font-bold rounded-lg text-sm transition-all border border-white/5"
              >
                Upload Another
              </button>
            </div>
          ) : (
            <>
              <div className={`
                w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-3 
                group-hover:scale-110 transition-transform border 
                ${isDragActive ? 'border-primary-500/60 bg-primary-500/20' : 'border-primary-500/20'}
              `}>
                {isDragActive ? (
                  <FileText className="w-6 h-6 text-primary-300" />
                ) : (
                  <Upload className="w-6 h-6 text-primary-400" />
                )}
              </div>
              <p className="font-bold text-lg text-white/90 group-hover:text-primary-300">
                {isDragActive ? 'Drop your PDF here' : 'Bulk Upload Timetable (PDF)'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/30 font-bold uppercase tracking-widest border border-white/5">Auto-Mapping</span>
                <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/30 font-bold uppercase tracking-widest border border-white/5">Fuzzy Match</span>
                <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/30 font-bold uppercase tracking-widest border border-white/5">PDF Only</span>
              </div>
              <p className="text-white/30 text-xs mt-3">Drag & drop or click to browse • Max 10MB</p>
            </>
          )}
        </div>
      </label>
    </div>
  );
}