import React, { useState, useEffect } from 'react';
import type { CommuteLog } from '../types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toPersianDigits = (s: string | number | null | undefined): string => {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

interface EditCommuteLogModalProps {
  log: CommuteLog;
  onClose: () => void;
  onSave: (updatedLog: CommuteLog) => Promise<void>;
}

const EditCommuteLogModal: React.FC<EditCommuteLogModalProps> = ({ log, onClose, onSave }) => {
  const [entryTime, setEntryTime] = useState({ hour: '', minute: '' });
  const [exitTime, setExitTime] = useState({ hour: '', minute: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // When the modal opens, parse the ISO string from the DB (which is in UTC)
    // and use getHours/getMinutes to get the time in the user's LOCAL timezone.
    if (log.entry_time) {
      const date = new Date(log.entry_time);
      setEntryTime({ hour: String(date.getHours()), minute: String(date.getMinutes()) });
    } else {
      setEntryTime({ hour: '', minute: '' });
    }
    if (log.exit_time) {
      const date = new Date(log.exit_time);
      setExitTime({ hour: String(date.getHours()), minute: String(date.getMinutes()) });
    } else {
      setExitTime({ hour: '', minute: '' });
    }
  }, [log]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryTime.hour || !entryTime.minute) {
        alert("ساعت ورود الزامی است.");
        return;
    }
    
    setIsSaving(true);
    
    // Use the original entry time to get the correct date (day, month, year)
    const baseDate = new Date(log.entry_time);
    
    // Create a new Date object for the entry time, preserving the original date but using the new LOCAL hours/minutes.
    const newEntryDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), parseInt(entryTime.hour), parseInt(entryTime.minute));

    let newExitDate = null;
    if (exitTime.hour && exitTime.minute) {
        // Create a new Date for the exit time, also based on the original entry day's date.
        newExitDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), parseInt(exitTime.hour), parseInt(exitTime.minute));
    }
    
    // toISOString() will correctly convert the local date object to a UTC timestamp for storage.
    const updatedLog: CommuteLog = {
      ...log,
      entry_time: newEntryDate.toISOString(),
      exit_time: newExitDate ? newExitDate.toISOString() : null,
    };
    
    try {
        await onSave(updatedLog);
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-800 dark:text-slate-100">
            ویرایش تردد برای {log.full_name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            aria-label="بستن"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">زمان ورود</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={entryTime.hour} onChange={e => setEntryTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans">
                   {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={entryTime.minute} onChange={e => setEntryTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans">
                   {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">زمان خروج (اختیاری)</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans">
                   <option value="">ساعت</option>
                   {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans">
                   <option value="">دقیقه</option>
                   {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 dark:bg-slate-900/50 dark:border-slate-700 rounded-b-xl">
             <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-slate-600 dark:text-gray-200 dark:border-slate-500 dark:hover:bg-slate-500" disabled={isSaving}>
                انصراف
             </button>
             <button type="submit" className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
                {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCommuteLogModal;
