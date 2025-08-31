import React, { useState, useMemo } from 'react';
import type { CommutingMember } from '../types';

interface AddShortLeaveModalProps {
  members: CommutingMember[];
  guards: string[];
  onClose: () => void;
  onSave: (data: { personnelCode: string; guardName: string; leaveTime: string; returnTime: string; }) => Promise<void>;
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

const jalaliToGregorian = (jy_str: string, jm_str: string, jd_str: string) => {
    const jy = parseInt(jy_str, 10);
    const jm = parseInt(jm_str, 10);
    const jd = parseInt(jd_str, 10);
    const sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const jy_temp = jy + 1595;
    let days = -355668 + (365 * jy_temp) + (Math.floor(jy_temp / 33) * 8) + Math.floor(((jy_temp % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097); days %= 146097; if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; } gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; } let gd = days + 1; sal_a[2] = ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28; let gm; for (gm = 1; gm <= 12; gm++) { if (gd <= sal_a[gm]) break; gd -= sal_a[gm]; } return { gy, gm, gd };
};

const partsToIso = (parts: { year: string, month: string, day: string, hour: string, minute: string }): string | null => {
    const { year, month, day, hour, minute } = parts;
    if (!year || !month || !day || !hour || !minute) return null;
    const { gy, gm, gd } = jalaliToGregorian(year, month, day);
    const date = new Date(Date.UTC(gy, gm - 1, gd, parseInt(hour), parseInt(minute)));
    date.setUTCMinutes(date.getUTCMinutes() - 210); // Adjust for Tehran Timezone
    return date.toISOString();
}

const AddShortLeaveModal: React.FC<AddShortLeaveModalProps> = ({ members, guards, onClose, onSave }) => {
  const [selectedPersonnelCode, setSelectedPersonnelCode] = useState('');
  const [selectedGuard, setSelectedGuard] = useState('');
  
  const today = useMemo(() => {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = formatter.formatToParts(d);
    return {
      year: parts.find(p => p.type === 'year')?.value || '',
      month: parts.find(p => p.type === 'month')?.value || '',
      day: parts.find(p => p.type === 'day')?.value || '',
    };
  }, []);

  const [leaveDateParts, setLeaveDateParts] = useState({ ...today, hour: '', minute: '' });
  const [returnDateParts, setReturnDateParts] = useState({ ...today, hour: '', minute: '' });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedPersonnelCode || !selectedGuard) {
      setError('لطفاً پرسنل و نگهبان را انتخاب کنید.');
      return;
    }
    const leaveTime = partsToIso(leaveDateParts);
    const returnTime = partsToIso(returnDateParts);

    if (!leaveTime || !returnTime) {
      setError('لطفاً زمان خروج و بازگشت را به طور کامل مشخص کنید.');
      return;
    }
    if (new Date(returnTime) <= new Date(leaveTime)) {
      setError('زمان بازگشت باید بعد از زمان خروج باشد.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        personnelCode: selectedPersonnelCode,
        guardName: selectedGuard,
        leaveTime,
        returnTime,
      });
    } catch (apiError) {
       setError(apiError instanceof Error ? apiError.message : 'خطایی در هنگام ذخیره رخ داد');
    } finally {
      setIsSaving(false);
    }
  };
  
  const renderTimeFields = (
      state: typeof leaveDateParts, 
      setState: React.Dispatch<React.SetStateAction<typeof leaveDateParts>>,
      label: string
    ) => (
    <div className="p-3 border rounded-md bg-gray-50">
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <select value={state.day} onChange={e => setState(p => ({...p, day: e.target.value}))} className="p-2 border rounded text-sm"><option value="">روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
            <select value={state.month} onChange={e => setState(p => ({...p, month: e.target.value}))} className="p-2 border rounded text-sm"><option value="">ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
            <select value={state.year} onChange={e => setState(p => ({...p, year: e.target.value}))} className="p-2 border rounded text-sm"><option value="">سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
            <select value={state.hour} onChange={e => setState(p => ({...p, hour: e.target.value}))} className="p-2 border rounded text-sm"><option value="">ساعت</option>{HOURS.map(h=><option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
            <select value={state.minute} onChange={e => setState(p => ({...p, minute: e.target.value}))} className="p-2 border rounded text-sm"><option value="">دقیقه</option>{MINUTES.map(m=><option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">ثبت تردد بین‌ساعتی (مرخصی)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <div className="p-3 text-sm text-red-800 bg-red-100 rounded-lg">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">پرسنل</label>
                    <select value={selectedPersonnelCode} onChange={e => setSelectedPersonnelCode(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="" disabled>یک نفر را انتخاب کنید...</option>
                        {members.map(m => <option key={m.id} value={m.personnel_code}>{m.full_name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نگهبان</label>
                    <select value={selectedGuard} onChange={e => setSelectedGuard(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="" disabled>شیفت را انتخاب کنید...</option>
                        {guards.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
            </div>
            {renderTimeFields(leaveDateParts, setLeaveDateParts, 'زمان خروج')}
            {renderTimeFields(returnDateParts, setReturnDateParts, 'زمان بازگشت')}
          </div>
          <div className="flex justify-end items-center p-4 border-t bg-gray-50">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100" disabled={isSaving}>انصراف</button>
            <button type="submit" className="mr-3 px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'ثبت تردد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddShortLeaveModal;
