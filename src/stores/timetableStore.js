import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const UPLOAD_STATES = {
  IDLE: 'IDLE',
  UPLOADING: 'UPLOADING',
  PARSING: 'PARSING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  CONFIRMED: 'CONFIRMED',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

const initialTimetableEntry = {
  department: '',
  year: 1,
  courseCode: '',
  subject: '',
  date: '',
  session: 'FN',
};

export const useTimetableStore = create(
  persist(
    (set, get) => ({
      uploadState: UPLOAD_STATES.IDLE,
      progress: 0,
      parsedEntries: [],
      error: null,

      setUploadState: (state) => set({ uploadState: state }),
      
      setProgress: (progress) => set({ progress }),
      
      setError: (error) => set({ 
        error, 
        uploadState: error ? UPLOAD_STATES.ERROR : get().uploadState 
      }),

      setParsedEntries: (entries) => set({ 
        parsedEntries: entries,
        uploadState: entries?.length > 0 
          ? UPLOAD_STATES.REVIEW_REQUIRED 
          : UPLOAD_STATES.IDLE
      }),

updateEntry: (key, updates) => set((state) => ({
         parsedEntries: state.parsedEntries.map((entry) =>
           entry._key === key ? { ...entry, ...updates } : entry
         ),
       })),

       updateEntryField: (key, field, value) => set((state) => ({
         parsedEntries: state.parsedEntries.map((entry) =>
           entry._key === key ? { ...entry, [field]: value } : entry
         ),
       })),

       removeParsedEntry: (key) => set((state) => ({
         parsedEntries: state.parsedEntries.filter((entry) => entry._key !== key),
       })),

confirmEntries: async () => {
         const { parsedEntries } = get();
         
         set({ uploadState: UPLOAD_STATES.CONFIRMED, progress: 50 });

         try {
           const entriesToSend = parsedEntries.map(({ _key, fieldConfidences, ...entry }) => ({
             ...entry,
             examDate: entry.examDate || entry.date
           }));
           const response = await fetch('/api/timetable/confirm', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(entriesToSend),
           });

           if (!response.ok) {
             let message = 'Failed to save';
             try {
               const error = await response.json();
               message = error.errors?.join(', ') || error.error || message;
             } catch {
               // non-JSON error body
             }
             throw new Error(message);
           }

           const saved = await response.json();
           set({ 
             uploadState: UPLOAD_STATES.SUCCESS, 
             progress: 100,
             parsedEntries: []
           });
           
           return saved;
         } catch (error) {
           set({ 
             error: error.message,
             uploadState: UPLOAD_STATES.ERROR
           });
           throw error;
         }
       },

      resetState: () => set({
        uploadState: UPLOAD_STATES.IDLE,
        progress: 0,
        parsedEntries: [],
        error: null,
      }),

      uploadPdf: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        set({ 
          uploadState: UPLOAD_STATES.UPLOADING,
          progress: 10,
          error: null
        });

        try {
          const timer = setInterval(() => {
            const currentProgress = get().progress;
            if (currentProgress < 70) {
              set({ progress: currentProgress + 15 });
            }
          }, 500);

          set({ uploadState: UPLOAD_STATES.PARSING });

          const response = await fetch('/api/timetable/extract', {
            method: 'POST',
            body: formData,
          });

          clearInterval(timer);

          if (!response.ok) {
            let message = `Failed to parse PDF (status ${response.status})`;
            try {
              const errorData = await response.json();
              message = errorData.error || message;
            } catch {
              // response body wasn't JSON (e.g. server error page) — keep default message
            }
            throw new Error(message);
          }

          let data;
          try {
            data = await response.json();
          } catch {
            throw new Error('Server returned an invalid response. Please check the backend logs.');
          }
          
const entriesWithIds = (data.entries || []).map((entry, index) => ({
             ...entry,
             _key: `${Date.now()}-${index}`,
             id: null,
             examDate: entry.examDate || entry.date,
             confidenceScore: entry.confidenceScore || 1.0,
             requiresReview: entry.requiresReview || entry.confidenceScore < 0.8,
           }));

          set({ 
            progress: 100,
            parsedEntries: entriesWithIds,
            uploadState: entriesWithIds.length > 0 
              ? UPLOAD_STATES.REVIEW_REQUIRED 
              : UPLOAD_STATES.ERROR
          });

          return entriesWithIds;
        } catch (error) {
          set({ 
            error: error.message,
            uploadState: UPLOAD_STATES.ERROR
          });
          throw error;
        }
      },

      getBaseDepartments: (students) => {
        if (!students || !Array.isArray(students)) return [];
        
        const baseDepts = new Set();
        students.forEach((student) => {
          if (student?.dept) {
            const base = student.dept.split(' ')[0].trim();
            if (base) baseDepts.add(base);
          }
        });
        
        return Array.from(baseDepts).sort();
      },
    }),
    {
      name: 'examseat-timetable-v1',
      partialize: (state) => ({
        parsedEntries: state.parsedEntries,
      }),
    }
  )
);