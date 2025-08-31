import React, { useState } from 'react';
import type { CommuteLog } from '../types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const toPersianDigits = (s: string | number) => String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);

interface AddShortLeaveModalProps {
  log: CommuteLog;
  onClose: () => void;
  onSave: (leaveData: { exitTime: string; entryTime: string }) => Promise<void>;
}

const AddShortLeaveModal: React.FC<AddShortLeaveModalProps> = ({ log, onClose, onSave }) => {
  const now = new Date();
  const [exitTime, setExitTime] = useState({ hour: String(now.getHours()), minute: String(now.getMinutes()) });
  const [entryTime, setEntryTime] = useState({ hour: String(now.getHours()), minute: String(now.getMinutes()) });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const baseDate = new Date(log.entry_time); 

    const exitDate = new Date(baseDate);
    exitDate.setHours(parseInt(exitTime.hour), parseInt(exitTime.minute), 0, 0);

    const entryDate = new Date(baseDate);
    entryDate.setHours(parseInt(entryTime.hour), parseInt(entryTime.minute), 0, 0);

    if (entryDate <= exitDate) {
      setError('زمان بازگشت باید بعد از زمان خروج باشد.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        exitTime: exitDate.toISOString(),
        entryTime: entryDate.toISOString(),
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'خطا در ذخیره‌سازی';
      setError(errorMessage);
      // Re-throw to prevent modal from closing automatically on error
      throw e;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">ثبت تردد بین ساعتی برای {log.full_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">زمان خروج</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={exitTime.hour} onChange={e => setExitTime(p => ({ ...p, hour: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                  {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={exitTime.minute} onChange={e => setExitTime(p => ({ ...p, minute: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                  {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">زمان بازگشت</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={entryTime.hour} onChange={e => setEntryTime(p => ({ ...p, hour: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                  {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={entryTime.minute} onChange={e => setEntryTime(p => ({ ...p, minute: e.target.value }))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
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
              {isSaving ? 'در حال ذخیره...' : 'ثبت تردد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddShortLeaveModal;