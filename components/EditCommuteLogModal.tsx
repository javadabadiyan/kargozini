import React, { useState, useEffect } from 'react';
import type { CommuteLog } from '../types';

interface EditCommuteLogModalProps {
  log: CommuteLog;
  guards: string[];
  onClose: () => void;
  onSave: (log: CommuteLog) => Promise<void>;
}

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => 1402 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toGregorian = (jy: number, jm: number, jd: number) => {
    let gy = jy + 621;
    return new Date(gy, jm - 1, jd);
};

const isoToPersianParts = (isoString: string | null) => {
    if (!isoString) return { year: '', month: '', day: '', hour: '', minute: '' };
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'Asia/Tehran'
    });
    const parts = formatter.formatToParts(date);
    return {
        year: parts.find(p => p.type === 'year')?.value || '',
        month: parts.find(p => p.type === 'month')?.value || '',
        day: parts.find(p => p.type === 'day')?.value || '',
        hour: parts.find(p => p.type === 'hour')?.value || '',
        minute: parts.find(p => p.type === 'minute')?.value || '',
    };
};

const persianPartsToIso = (parts: ReturnType<typeof isoToPersianParts>): string | null => {
    const { year, month, day, hour, minute } = parts;
    if (!year || !month || !day || !hour || !minute) return null;
    const date = toGregorian(parseInt(year), parseInt(month), parseInt(day));
    date.setHours(parseInt(hour), parseInt(minute));
    date.setMinutes(date.getMinutes() - 210); // Adjust for Iran timezone
    return date.toISOString();
}

const EditCommuteLogModal: React.FC<EditCommuteLogModalProps> = ({ log, guards, onClose, onSave }) => {
  const [guardName, setGuardName] = useState(log.guard_name);
  const [entryParts, setEntryParts] = useState(isoToPersianParts(log.entry_time));
  const [exitParts, setExitParts] = useState(isoToPersianParts(log.exit_time));
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updatedLog: CommuteLog = {
      ...log,
      guard_name: guardName,
      entry_time: persianPartsToIso(entryParts)!,
      exit_time: persianPartsToIso(exitParts),
    };
    await onSave(updatedLog);
    setIsSaving(false);
  };
  
  const renderTimeFields = (
      state: ReturnType<typeof isoToPersianParts>, 
      setState: React.Dispatch<React.SetStateAction<ReturnType<typeof isoToPersianParts>>>,
      label: string
    ) => (
    <div className="p-3 border rounded-md bg-gray-50">
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        <div className="grid grid-cols-5 gap-2">
            <select value={state.day} onChange={e => setState(p => ({...p, day: e.target.value}))} className="p-2 border rounded text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
            <select value={state.month} onChange={e => setState(p => ({...p, month: e.target.value}))} className="p-2 border rounded text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
            <select value={state.year} onChange={e => setState(p => ({...p, year: e.target.value}))} className="p-2 border rounded text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
            <select value={state.hour} onChange={e => setState(p => ({...p, hour: e.target.value}))} className="p-2 border rounded text-sm"><option value="">ساعت</option>{HOURS.map(h=><option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
            <select value={state.minute} onChange={e => setState(p => ({...p, minute: e.target.value}))} className="p-2 border rounded text-sm"><option value="">دقیقه</option>{MINUTES.map(m=><option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">ویرایش تردد {log.full_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نگهبان</label>
              <select value={guardName} onChange={e => setGuardName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                {guards.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {renderTimeFields(entryParts, setEntryParts, 'زمان ورود')}
            {renderTimeFields(exitParts, setExitParts, 'زمان خروج (برای پاک کردن، ساعت و دقیقه را خالی بگذارید)')}
          </div>
          <div className="flex justify-end items-center p-4 border-t bg-gray-50">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100" disabled={isSaving}>انصراف</button>
            <button type="submit" className="mr-3 px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCommuteLogModal;
