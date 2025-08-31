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
    if (log.entry_time) {
      const date = new Date(log.entry_time);
      setEntryTime({ hour: String(date.getUTCHours()), minute: String(date.getUTCMinutes()) });
    } else {
      setEntryTime({ hour: '', minute: '' });
    }
    if (log.exit_time) {
      const date = new Date(log.exit_time);
      setExitTime({ hour: String(date.getUTCHours()), minute: String(date.getUTCMinutes()) });
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
    
    const baseEntryDate = new Date(log.entry_time);
    baseEntryDate.setUTCHours(parseInt(entryTime.hour), parseInt(entryTime.minute), 0, 0);

    let exitDate = null;
    if (exitTime.hour && exitTime.minute) {
        // Assume exit is on the same day as entry
        exitDate = new Date(log.entry_time);
        exitDate.setUTCHours(parseInt(exitTime.hour), parseInt(exitTime.minute), 0, 0);
    }
    
    const updatedLog: CommuteLog = {
      ...log,
      entry_time: baseEntryDate.toISOString(),
      exit_time: exitDate ? exitDate.toISOString() : null,
    };
    
    try {
        await onSave(updatedLog);
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-800">
            ویرایش تردد برای {log.full_name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            aria-label="بستن"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">زمان ورود</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={entryTime.hour} onChange={e => setEntryTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                   {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={entryTime.minute} onChange={e => setEntryTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                   {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">زمان خروج (اختیاری)</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                   <option value="">ساعت</option>
                   {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                   <option value="">دقیقه</option>
                   {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
             <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100" disabled={isSaving}>
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