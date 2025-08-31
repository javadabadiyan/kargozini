import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CommutingMember, CommuteLog, Personnel } from '../../types';
import { SearchIcon, PencilIcon, TrashIcon, PlusCircleIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import AddShortLeaveModal from '../AddShortLeaveModal';

declare const XLSX: any;

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 5 }, (_, i) => 1402 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی'
];

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

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};


const LogCommutePage: React.FC = () => {
    const [action, setAction] = useState<'entry' | 'exit'>('entry');
    const [members, setMembers] = useState<CommutingMember[]>([]);
    const [groupedPersonnel, setGroupedPersonnel] = useState<{ [key: string]: CommutingMember[] }>({});
    const [selectedPersonnelCodes, setSelectedPersonnelCodes] = useState<string[]>([]);
    const [selectedGuard, setSelectedGuard] = useState<string>(GUARDS[0]);

    const [date, setDate] = useState<{ year: string; month: string; day: string }>({ year: '', month: '', day: '' });
    const [time, setTime] = useState<{ hour: string; minute: string }>({ hour: '', minute: '' });
    
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // History states
    const [logs, setLogs] = useState<CommuteLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchDate, setSearchDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [isShortLeaveModalOpen, setIsShortLeaveModalOpen] = useState(false);
    
    const [refreshKey, setRefreshKey] = useState(0); // Used to trigger re-fetch

    const resetDateAndTime = useCallback(() => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'Asia/Tehran'
        });
        const parts = formatter.formatToParts(now);
        setDate({
            year: parts.find(p => p.type === 'year')?.value || '',
            month: parts.find(p => p.type === 'month')?.value || '',
            day: parts.find(p => p.type === 'day')?.value || '',
        });
        setTime({
            hour: parts.find(p => p.type === 'hour')?.value || '',
            minute: parts.find(p => p.type === 'minute')?.value || '',
        });
    }, []);

    useEffect(() => {
        resetDateAndTime();
    }, [resetDateAndTime]);

    const fetchCommutingMembers = useCallback(async () => {
        try {
            const response = await fetch('/api/commuting-members');
            if (!response.ok) throw new Error('Failed to fetch commuting members');
            const data = await response.json();
            const fetchedMembers = data.members || [];
            setMembers(fetchedMembers);
            const grouped = fetchedMembers.reduce((acc: { [key: string]: CommutingMember[] }, member: CommutingMember) => {
                const unit = member.department || 'نامشخص';
                if (!acc[unit]) acc[unit] = [];
                acc[unit].push(member);
                return acc;
            }, {});
            setGroupedPersonnel(grouped);
        } catch (error) {
            setStatus({ type: 'error', message: 'خطا در دریافت لیست پرسنل تردد' });
        }
    }, []);
    
    const fetchLogs = useCallback(async (page: number, sDate: Date, search: string) => {
        setHistoryLoading(true);
        setHistoryError(null);
        try {
            const dateString = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
            const response = await fetch(`/api/commute-logs?page=${page}&searchDate=${dateString}&searchTerm=${encodeURIComponent(search)}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'خطا در دریافت تاریخچه تردد');
            }
            const data = await response.json();
            setLogs(data.logs || []);
            setTotalPages(Math.ceil((data.totalCount || 0) / 10));
        } catch (err) {
            setHistoryError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCommutingMembers();
    }, [fetchCommutingMembers]);

    useEffect(() => {
        fetchLogs(currentPage, searchDate, debouncedSearchTerm);
    }, [currentPage, searchDate, debouncedSearchTerm, fetchLogs, refreshKey]);

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPersonnelCodes.length === 0) {
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل را انتخاب کنید.' });
            return;
        }
        if (!selectedGuard) {
            setStatus({ type: 'error', message: 'لطفاً شیفت کاری (نگهبان) را انتخاب کنید.' });
            return;
        }

        const { year, month, day } = date;
        const { hour, minute } = time;

        let timestampOverride = null;
        if (year && month && day && hour && minute) {
            const { gy, gm, gd } = jalaliToGregorian(year, month, day);
            const gregDate = new Date(Date.UTC(gy, gm - 1, gd, parseInt(hour, 10), parseInt(minute, 10)));
            gregDate.setUTCMinutes(gregDate.getUTCMinutes() - 210); // Adjust for Tehran Timezone to UTC
            timestampOverride = gregDate.toISOString();
        }

        setIsSubmitting(true);
        setStatus({ type: 'info', message: 'در حال ثبت تردد...' });

        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personnelCodes: selectedPersonnelCodes,
                    guardName: selectedGuard,
                    action,
                    timestampOverride
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'خطا در ثبت تردد');
            }
            setStatus({ type: 'success', message: result.message });
            setSelectedPersonnelCodes([]);
            setRefreshKey(k => k + 1); // Trigger history refresh
        } catch (error) {
            setStatus({ type: 'error', message: error instanceof Error ? error.message : 'خطای ناشناخته' });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
     const handlePersonnelSelection = (code: string) => {
        setSelectedPersonnelCodes(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const handleUnitSelection = (unit: string, select: boolean) => {
        const unitPersonnelCodes = groupedPersonnel[unit]?.map(p => p.personnel_code) || [];
        if (select) {
            setSelectedPersonnelCodes(prev => [...new Set([...prev, ...unitPersonnelCodes])]);
        } else {
            setSelectedPersonnelCodes(prev => prev.filter(c => !unitPersonnelCodes.includes(c)));
        }
    };
    
    const handleClearDate = (e: React.MouseEvent) => {
        e.preventDefault();
        setDate({ year: '', month: '', day: '' });
    };

    return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-lg">
             <h2 className="text-2xl font-bold text-gray-800 mb-4">ترددهای ثبت شده</h2>
             {/* History Table and controls will be here... */}
              <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500">بخش تاریخچه ترددها در حال ساخت است.</p>
            </div>
        </div>

        <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-lg sticky top-6">
                <form onSubmit={handleLogSubmit} className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-semibold text-gray-700">نوع عملیات</label>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setAction('entry')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${action === 'entry' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>ثبت ورود</button>
                            <button type="button" onClick={() => setAction('exit')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${action === 'exit' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>ثبت خروج</button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">تاریخ</label>
                        <div className="grid grid-cols-3 gap-2">
                            <select value={date.day} onChange={e => setDate(p => ({...p, day: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                            <select value={date.month} onChange={e => setDate(p => ({...p, month: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
                            <select value={date.year} onChange={e => setDate(p => ({...p, year: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
                        </div>
                        <div className="flex justify-start gap-4 mt-2 text-xs">
                           <button type="button" onClick={resetDateAndTime} className="text-blue-600 hover:underline">امروز</button>
                           <button type="button" onClick={handleClearDate} className="text-gray-500 hover:underline">پاک کردن</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={action !== 'entry' ? 'opacity-40' : ''}>
                           <label className="block text-sm font-semibold text-gray-700 mb-2">ساعت ورود</label>
                           <div className="flex gap-2">
                             <select value={time.hour} onChange={e => setTime(p => ({...p, hour: e.target.value}))} disabled={action !== 'entry'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200"><option value="" disabled>ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                             <select value={time.minute} onChange={e => setTime(p => ({...p, minute: e.target.value}))} disabled={action !== 'entry'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200"><option value="" disabled>دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                           </div>
                        </div>
                         <div className={action !== 'exit' ? 'opacity-40' : ''}>
                           <label className="block text-sm font-semibold text-gray-700 mb-2">ساعت خروج</label>
                           <div className="flex gap-2">
                             <select value={time.hour} onChange={e => setTime(p => ({...p, hour: e.target.value}))} disabled={action !== 'exit'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200"><option value="" disabled>ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                             <select value={time.minute} onChange={e => setTime(p => ({...p, minute: e.target.value}))} disabled={action !== 'exit'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200"><option value="" disabled>دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                           </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">شیفت کاری</label>
                        <div className="space-y-2">
                           {GUARDS.map(guard => (
                            <label key={guard} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${selectedGuard === guard ? 'bg-blue-50 border-blue-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={(e) => setSelectedGuard(e.target.value)} className="hidden" />
                                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${selectedGuard === guard ? 'border-blue-600 bg-white' : 'border-gray-400'}`}>
                                    {selectedGuard === guard && <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>}
                                </span>
                                <span className="text-sm">{guard}</span>
                            </label>
                           ))}
                        </div>
                    </div>

                     <div className="border-t pt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">انتخاب پرسنل ({toPersianDigits(selectedPersonnelCodes.length)} نفر)</label>
                         <div className="border rounded-lg p-2 max-h-60 overflow-y-auto bg-slate-50">
                            {Object.entries(groupedPersonnel).map(([unit, personnelInUnit]) => (
                                <details key={unit} className="group" open>
                                    <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-200 rounded-md">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                className="ml-2"
                                                checked={personnelInUnit.every(p => selectedPersonnelCodes.includes(p.personnel_code))}
                                                onChange={(e) => handleUnitSelection(unit, e.target.checked)}
                                            />
                                            <span className="font-semibold text-sm">{unit}</span>
                                        </div>
                                    </summary>
                                    <ul className="pr-6 space-y-1 py-1">
                                        {personnelInUnit.map(p => (
                                            <li key={p.id}>
                                                <label className="flex items-center p-1.5 rounded-md hover:bg-slate-200 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="ml-2"
                                                        checked={selectedPersonnelCodes.includes(p.personnel_code)}
                                                        onChange={() => handlePersonnelSelection(p.personnel_code)}
                                                    />
                                                    <span className="text-sm text-gray-700">{p.full_name}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ))}
                        </div>
                    </div>
                    
                    {status && (
                        <div className={`p-3 text-sm rounded-lg ${
                            status.type === 'success' ? 'bg-green-100 text-green-800' :
                            status.type === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>{status.message}</div>
                    )}

                    <button 
                      type="submit"
                      disabled={isSubmitting || selectedPersonnelCodes.length === 0}
                      className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:scale-100"
                    >
                      {isSubmitting ? 'در حال ثبت...' : 
                        `ثبت ${action === 'entry' ? 'ورود' : 'خروج'} برای ${toPersianDigits(selectedPersonnelCodes.length)} نفر`}
                    </button>
                </form>
            </div>
        </div>
    </div>
    );
};

export default LogCommutePage;
