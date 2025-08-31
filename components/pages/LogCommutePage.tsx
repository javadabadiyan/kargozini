import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { SearchIcon, PencilIcon, TrashIcon, PlusCircleIcon, ArrowRightOnRectangleIcon } from '../icons/Icons';
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

const formatTime = (isoString: string | null) => {
    if (!isoString) return '--:--';
    try {
        const date = new Date(isoString);
        const time = date.toLocaleTimeString('fa-IR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Tehran'
        });
        return toPersianDigits(time);
    } catch {
        return 'زمان نامعتبر';
    }
};

const LogCommutePage: React.FC = () => {
    const [members, setMembers] = useState<CommutingMember[]>([]);
    const [groupedPersonnel, setGroupedPersonnel] = useState<{ [key: string]: CommutingMember[] }>({});
    const [selectedPersonnelCodes, setSelectedPersonnelCodes] = useState<string[]>([]);
    const [selectedGuard, setSelectedGuard] = useState<string>(GUARDS[0]);

    const [date, setDate] = useState<{ year: string; month: string; day: string }>({ year: '', month: '', day: '' });
    const [time, setTime] = useState<{ hour: string; minute: string }>({ hour: '', minute: '' });
    
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [logs, setLogs] = useState<CommuteLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [searchJalaliDate, setSearchJalaliDate] = useState({ year: '', month: '', day: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [isShortLeaveModalOpen, setIsShortLeaveModalOpen] = useState(false);
    
    const [refreshKey, setRefreshKey] = useState(0);

    const [personnelSearchTerm, setPersonnelSearchTerm] = useState('');

    const filteredGroupedPersonnel = useMemo(() => {
        if (!personnelSearchTerm.trim()) {
            return groupedPersonnel;
        }
        const lowercasedTerm = personnelSearchTerm.toLowerCase().trim();
        const filteredGroups: { [key: string]: CommutingMember[] } = {};
        for (const unit in groupedPersonnel) {
            const filteredMembers = groupedPersonnel[unit].filter(member =>
                member.full_name.toLowerCase().includes(lowercasedTerm) ||
                member.personnel_code.includes(lowercasedTerm)
            );
            if (filteredMembers.length > 0) {
                filteredGroups[unit] = filteredMembers;
            }
        }
        return filteredGroups;
    }, [personnelSearchTerm, groupedPersonnel]);
    
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
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
            year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Tehran'
        });
        const parts = formatter.formatToParts(now);
        setSearchJalaliDate({
            year: parts.find(p => p.type === 'year')?.value || '',
            month: parts.find(p => p.type === 'month')?.value || '',
            day: parts.find(p => p.type === 'day')?.value || '',
        });
    }, [resetDateAndTime]);

    const fetchCommutingMembers = useCallback(async () => {
        try {
            const response = await fetch('/api/commuting-members');
            if (!response.ok) throw new Error('Failed to fetch commuting members');
            const data = await response.json();
            const fetchedMembers = data.members || [];
            setMembers(fetchedMembers);
            const grouped = fetchedMembers.reduce((acc: { [key: string]: CommutingMember[] }, member: CommutingMember) => {
                const unit = member.department || 'واحد نامشخص';
                if (!acc[unit]) acc[unit] = [];
                acc[unit].push(member);
                return acc;
            }, {});
            setGroupedPersonnel(grouped);
        } catch (error) {
            setStatus({ type: 'error', message: 'خطا در دریافت لیست پرسنل تردد' });
        }
    }, []);
    
    const fetchLogs = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError(null);
        try {
            const { year, month, day } = searchJalaliDate;
            if(!year || !month || !day) return;
            const {gy, gm, gd} = jalaliToGregorian(year, month, day);
            const dateString = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
            
            const response = await fetch(`/api/commute-logs?searchDate=${dateString}&searchTerm=${encodeURIComponent(debouncedSearchTerm)}&pageSize=100`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'خطا در دریافت تاریخچه تردد');
            }
            const data = await response.json();
            setLogs(data.logs || []);
        } catch (err) {
            setHistoryError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setHistoryLoading(false);
        }
    }, [searchJalaliDate, debouncedSearchTerm]);

    useEffect(() => {
        fetchCommutingMembers();
    }, [fetchCommutingMembers]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs, refreshKey]);

    const handleLogEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPersonnelCodes.length === 0) {
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل را انتخاب کنید.' }); return;
        }
        const { year, month, day } = date;
        const { hour, minute } = time;
        let timestampOverride = null;
        if (year && month && day && hour && minute) {
            const { gy, gm, gd } = jalaliToGregorian(year, month, day);
            const gregDate = new Date(Date.UTC(gy, gm - 1, gd, parseInt(hour, 10), parseInt(minute, 10)));
            gregDate.setUTCMinutes(gregDate.getUTCMinutes() - 210);
            timestampOverride = gregDate.toISOString();
        }

        setIsSubmitting(true);
        setStatus({ type: 'info', message: 'در حال ثبت ورود...' });
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelCodes: selectedPersonnelCodes, guardName: selectedGuard, action: 'entry', timestampOverride }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'خطا در ثبت تردد');
            setStatus({ type: 'success', message: result.message });
            setSelectedPersonnelCodes([]);
            setRefreshKey(k => k + 1);
        } catch (error) {
            setStatus({ type: 'error', message: error instanceof Error ? error.message : 'خطای ناشناخته' });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleLogExit = async (personnelCode: string) => {
        if (!window.confirm(`آیا از ثبت خروج برای این پرسنل با زمان فعلی اطمینان دارید؟`)) return;
        
        setStatus({ type: 'info', message: 'در حال ثبت خروج...' });
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelCodes: [personnelCode], guardName: selectedGuard, action: 'exit' }),
            });
             const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'خطا در ثبت خروج');
            setStatus({ type: 'success', message: result.message });
            setRefreshKey(k => k + 1);
        } catch (error) {
             setStatus({ type: 'error', message: error instanceof Error ? error.message : 'خطای ناشناخته' });
        } finally {
             setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleUnitSelection = (unit: string, select: boolean) => {
        const unitCodes = groupedPersonnel[unit]?.map(p => p.personnel_code) || [];
        if (select) setSelectedPersonnelCodes(prev => [...new Set([...prev, ...unitCodes])]);
        else setSelectedPersonnelCodes(prev => prev.filter(c => !unitCodes.includes(c)));
    };
    
    const handleEditClick = (log: CommuteLog) => { setEditingLog(log); setIsEditModalOpen(true); };
    const handleCloseModal = () => { setIsEditModalOpen(false); setEditingLog(null); setIsShortLeaveModalOpen(false); };
    
    const handleDeleteLog = async (id: number) => {
        if (window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) {
            try {
                const response = await fetch(`/api/commute-logs?id=${id}`, { method: 'DELETE' });
                if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'خطا در حذف'); }
                setStatus({ type: 'success', message: 'تردد با موفقیت حذف شد.' });
                setRefreshKey(k => k + 1);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
            }
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleSaveLog = async (log: CommuteLog) => {
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(log)
            });
            if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'خطا در ذخیره'); }
            const result = await response.json();
            setStatus({ type: 'success', message: result.message });
            setRefreshKey(k => k + 1);
            handleCloseModal();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ذخیره‌سازی' });
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-lg">
             <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b-2 border-gray-100 pb-4">
                 <h2 className="text-xl font-bold text-gray-800">
                    ترددهای ثبت شده در {toPersianDigits(searchJalaliDate.year)}/{toPersianDigits(searchJalaliDate.month)}/{toPersianDigits(searchJalaliDate.day)}
                </h2>
                 <div className="flex items-center gap-2">
                    <button onClick={() => {}} className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded-lg hover:bg-green-200 transition-colors">ورود از اکسل</button>
                    <a href="#" className="text-sm text-blue-600 hover:underline">دانلود نمونه فایل اکسل</a>
                 </div>
             </div>
             
             <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <select value={searchJalaliDate.day} onChange={e => setSearchJalaliDate(p => ({...p, day: e.target.value}))} className="p-2 border border-gray-300 rounded-lg text-sm w-20 bg-white"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                    <select value={searchJalaliDate.month} onChange={e => setSearchJalaliDate(p => ({...p, month: e.target.value}))} className="p-2 border border-gray-300 rounded-lg text-sm w-32 bg-white"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
                    <select value={searchJalaliDate.year} onChange={e => setSearchJalaliDate(p => ({...p, year: e.target.value}))} className="p-2 border border-gray-300 rounded-lg text-sm w-24 bg-white"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
                </div>
                <div className="relative flex-grow">
                    <input type="text" placeholder="جستجوی پرسنل در لیست روزانه..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-slate-50">
                        <tr>
                            {['پرسنل', 'شیفت', 'ورود', 'خروج', 'عملیات'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {historyLoading && <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {historyError && <tr><td colSpan={5} className="text-center p-4 text-red-500">{historyError}</td></tr>}
                        {!historyLoading && !historyError && logs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">
                                    <div>{log.full_name || log.personnel_code}</div>
                                    <div className="text-xs text-gray-500">{log.full_name && `کد: ${toPersianDigits(log.personnel_code)}`}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{log.guard_name?.split('|')[0].trim()}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 tracking-wider">{formatTime(log.entry_time)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 tracking-wider">{formatTime(log.exit_time)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center space-x-1 space-x-reverse">
                                    {log.exit_time === null && (
                                      <button onClick={() => handleLogExit(log.personnel_code)} title="ثبت خروج" className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full transition-colors"><ArrowRightOnRectangleIcon className="w-5 h-5" /></button>
                                    )}
                                    <button onClick={() => handleEditClick(log)} title="ویرایش" className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"><PencilIcon className="w-5 h-5" /></button>
                                    <button onClick={() => handleDeleteLog(log.id)} title="حذف" className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        ))}
                        {!historyLoading && !historyError && logs.length === 0 && (
                            <tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ ترددی برای تاریخ انتخاب شده یافت نشد.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-lg sticky top-6">
                <h3 className="text-xl font-bold text-gray-800 mb-1">ثبت تردد</h3>
                <p className="text-sm text-gray-500 mb-6">ورود و خروج پرسنل را در شیفت‌های مختلف ثبت کنید.</p>
                <form onSubmit={handleLogEntry} className="space-y-5">
                     <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">تاریخ</label>
                        <div className="grid grid-cols-3 gap-2">
                            <select value={date.day} onChange={e => setDate(p => ({...p, day: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                            <select value={date.month} onChange={e => setDate(p => ({...p, month: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
                            <select value={date.year} onChange={e => setDate(p => ({...p, year: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
                        </div>
                        <div className="flex justify-start mt-2 text-xs">
                           <button type="button" onClick={resetDateAndTime} className="text-blue-600 hover:underline">امروز</button>
                        </div>
                    </div>

                    <div>
                       <label className="block text-sm font-semibold text-gray-700 mb-2">ساعت ورود</label>
                       <div className="flex gap-2">
                         <select value={time.hour} onChange={e => setTime(p => ({...p, hour: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                         <select value={time.minute} onChange={e => setTime(p => ({...p, minute: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                       </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">شیفت کاری</label>
                        <div className="space-y-2">
                           {GUARDS.map(guard => (<label key={guard} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${selectedGuard === guard ? 'bg-blue-50 border-blue-500 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={(e) => setSelectedGuard(e.target.value)} className="hidden" />
                                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${selectedGuard === guard ? 'border-blue-600 bg-white' : 'border-gray-400'}`}>{selectedGuard === guard && <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>}</span>
                                <span className="text-sm">{guard}</span>
                           </label>))}
                        </div>
                    </div>

                     <div className="border-t pt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">انتخاب پرسنل ({toPersianDigits(selectedPersonnelCodes.length)} نفر)</label>
                        <div className="relative mb-2">
                           <input
                               type="text"
                               placeholder="جستجوی پرسنل..."
                               value={personnelSearchTerm}
                               onChange={e => setPersonnelSearchTerm(e.target.value)}
                               className="w-full pr-10 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                           />
                           <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                         <div className="border rounded-lg p-2 max-h-48 overflow-y-auto bg-slate-50">
                            {Object.keys(filteredGroupedPersonnel).length === 0 && <p className="text-center text-sm text-gray-500 py-4">پرسنلی یافت نشد.</p>}
                            {Object.entries(filteredGroupedPersonnel).sort(([a], [b]) => a.localeCompare(b)).map(([unit, personnelInUnit]) => (
                                <details key={unit} className="group" open>
                                    <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-200 rounded-md list-none">
                                        <div className="flex items-center">
                                            <input type="checkbox" className="ml-2 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                checked={(groupedPersonnel[unit] || []).every(p => selectedPersonnelCodes.includes(p.personnel_code))}
                                                onChange={(e) => handleUnitSelection(unit, e.target.checked)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="font-semibold text-sm">{unit}</span>
                                        </div>
                                    </summary>
                                    <ul className="pr-6 space-y-1 py-1">
                                        {personnelInUnit.map(p => (
                                            <li key={p.id}>
                                                <label className="flex items-center p-1.5 rounded-md hover:bg-slate-200 cursor-pointer">
                                                    <input type="checkbox" className="ml-2 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                        checked={selectedPersonnelCodes.includes(p.personnel_code)}
                                                        onChange={() => setSelectedPersonnelCodes(prev => prev.includes(p.personnel_code) ? prev.filter(c => c !== p.personnel_code) : [...prev, p.personnel_code])}
                                                    />
                                                    <div>
                                                        <span className="text-sm text-gray-800">{p.full_name}</span>
                                                        <div className="text-xs text-gray-500">کد: {toPersianDigits(p.personnel_code)}</div>
                                                    </div>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ))}
                        </div>
                    </div>
                    
                    {status && (<div className={`p-3 text-sm rounded-lg ${
                        status.type === 'success' ? 'bg-green-100 text-green-800' : status.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>{status.message}</div>)}
                    <button type="submit" disabled={isSubmitting || selectedPersonnelCodes.length === 0} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:scale-100">
                      {isSubmitting ? 'در حال ثبت...' : `ثبت ورود برای ${toPersianDigits(selectedPersonnelCodes.length)} نفر`}
                    </button>
                </form>
            </div>
        </div>

        {isEditModalOpen && editingLog && (
            <EditCommuteLogModal log={editingLog} guards={GUARDS} onClose={handleCloseModal} onSave={handleSaveLog} />
        )}
        {isShortLeaveModalOpen && (
            <AddShortLeaveModal members={members} guards={GUARDS} onClose={handleCloseModal} onSave={() => Promise.resolve()} />
        )}
    </div>
    );
};

export default LogCommutePage;