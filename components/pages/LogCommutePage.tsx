import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
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

const formatTime = (isoString: string | null) => {
    if (!isoString) return ' - ';
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
    const [action, setAction] = useState<'entry' | 'exit'>('entry');
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
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchDate, setSearchDate] = useState(new Date());
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
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل را انتخاب کنید.' }); return;
        }
        if (!selectedGuard) {
            setStatus({ type: 'error', message: 'لطفاً شیفت کاری (نگهبان) را انتخاب کنید.' }); return;
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
        setStatus({ type: 'info', message: 'در حال ثبت تردد...' });
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelCodes: selectedPersonnelCodes, guardName: selectedGuard, action, timestampOverride }),
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

    const handlePersonnelSelection = (code: string) => setSelectedPersonnelCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    const handleUnitSelection = (unit: string, select: boolean) => {
        const unitCodes = groupedPersonnel[unit]?.map(p => p.personnel_code) || [];
        if (select) setSelectedPersonnelCodes(prev => [...new Set([...prev, ...unitCodes])]);
        else setSelectedPersonnelCodes(prev => prev.filter(c => !unitCodes.includes(c)));
    };
    
    const handleClearDate = (e: React.MouseEvent) => { e.preventDefault(); setDate({ year: '', month: '', day: '' }); };

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
    
    const handleSaveShortLeave = async (data: any) => {
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, action: 'short_leave' }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'خطا در ثبت تردد بین‌ساعتی');
            setStatus({ type: 'success', message: result.message });
            setRefreshKey(k => k + 1);
            handleCloseModal();
        } catch (err) {
             throw err; // Propagate error to modal
        }
    }

    return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-lg">
             <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b-2 border-gray-100 pb-4">
                 <h2 className="text-2xl font-bold text-gray-800">ترددهای ثبت شده</h2>
                 <button onClick={() => setIsShortLeaveModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
                     <PlusCircleIcon className="w-5 h-5" />
                     ثبت تردد بین‌ساعتی
                 </button>
             </div>
             
             <div className="flex flex-wrap gap-4 mb-4">
                <input
                    type="date"
                    value={searchDate.toISOString().split('T')[0]}
                    onChange={e => setSearchDate(new Date(e.target.value))}
                    className="p-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="relative flex-grow">
                    <input type="text" placeholder="جستجوی پرسنل..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-100">
                        <tr>
                            {['پرسنل', 'شیفت', 'ورود', 'خروج', 'نوع', 'عملیات'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {historyLoading && <tr><td colSpan={6} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {historyError && <tr><td colSpan={6} className="text-center p-4 text-red-500">{historyError}</td></tr>}
                        {!historyLoading && !historyError && logs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{log.full_name || log.personnel_code}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{log.guard_name?.split('|')[0].trim()}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono tracking-wider">{formatTime(log.entry_time)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono tracking-wider">{formatTime(log.exit_time)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${log.log_type === 'short_leave' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{log.log_type === 'short_leave' ? 'بین ساعتی' : 'اصلی'}</span></td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center space-x-2 space-x-reverse">
                                    <button onClick={() => handleEditClick(log)} className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"><PencilIcon className="w-5 h-5" /></button>
                                    <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full transition-colors"><TrashIcon className="w-5 h-5" /></button>
                                </td>
                            </tr>
                        ))}
                        {!historyLoading && !historyError && logs.length === 0 && (
                            <tr><td colSpan={6} className="text-center p-4 text-gray-500">هیچ ترددی برای تاریخ انتخاب شده یافت نشد.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {!historyLoading && !historyError && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                    <span className="text-sm text-gray-600">صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                </div>
            )}
        </div>

        <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-lg shadow-lg sticky top-6">
                <form onSubmit={handleLogSubmit} className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2"><label className="text-sm font-semibold text-gray-700">نوع عملیات</label></div>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button type="button" onClick={() => setAction('entry')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${action === 'entry' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>ثبت ورود</button>
                            <button type="button" onClick={() => setAction('exit')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${action === 'exit' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>ثبت خروج</button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">تاریخ</label>
                        <div className="grid grid-cols-3 gap-2">
                            <select value={date.day} onChange={e => setDate(p => ({...p, day: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                            <select value={date.month} onChange={e => setDate(p => ({...p, month: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}</select>
                            <select value={date.year} onChange={e => setDate(p => ({...p, year: e.target.value}))} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
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
                             <select value={time.hour} onChange={e => setTime(p => ({...p, hour: e.target.value}))} disabled={action !== 'entry'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md disabled:bg-gray-200"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                             <select value={time.minute} onChange={e => setTime(p => ({...p, minute: e.target.value}))} disabled={action !== 'entry'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md disabled:bg-gray-200"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                           </div>
                        </div>
                         <div className={action !== 'exit' ? 'opacity-40' : ''}>
                           <label className="block text-sm font-semibold text-gray-700 mb-2">ساعت خروج</label>
                           <div className="flex gap-2">
                             <select value={time.hour} onChange={e => setTime(p => ({...p, hour: e.target.value}))} disabled={action !== 'exit'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md disabled:bg-gray-200"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                             <select value={time.minute} onChange={e => setTime(p => ({...p, minute: e.target.value}))} disabled={action !== 'exit'} className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-300 rounded-md disabled:bg-gray-200"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                           </div>
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
                         <div className="border rounded-lg p-2 max-h-60 overflow-y-auto bg-slate-50">
                            {Object.keys(filteredGroupedPersonnel).length === 0 && (
                                <p className="text-center text-sm text-gray-500 py-4">پرسنلی یافت نشد.</p>
                            )}
                            {Object.entries(filteredGroupedPersonnel).sort(([a], [b]) => a.localeCompare(b)).map(([unit, personnelInUnit]) => {
                                const originalUnitPersonnel = groupedPersonnel[unit] || [];
                                return (
                                <details key={unit} className="group" open>
                                    <summary className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-200 rounded-md list-none">
                                        <div className="flex items-center">
                                            <input type="checkbox" className="ml-2 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                checked={originalUnitPersonnel.length > 0 && originalUnitPersonnel.every(p => selectedPersonnelCodes.includes(p.personnel_code))}
                                                onChange={(e) => handleUnitSelection(unit, e.target.checked)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="font-semibold text-sm">{unit} ({toPersianDigits(originalUnitPersonnel.length)})</span>
                                        </div>
                                         <div className="text-xs text-gray-500">{toPersianDigits(originalUnitPersonnel.filter(p => selectedPersonnelCodes.includes(p.personnel_code)).length)} / {toPersianDigits(originalUnitPersonnel.length)}</div>
                                    </summary>
                                    <ul className="pr-6 space-y-1 py-1">
                                        {personnelInUnit.map(p => (
                                            <li key={p.id}>
                                                <label className="flex items-center p-1.5 rounded-md hover:bg-slate-200 cursor-pointer">
                                                    <input type="checkbox" className="ml-2 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                        checked={selectedPersonnelCodes.includes(p.personnel_code)}
                                                        onChange={() => handlePersonnelSelection(p.personnel_code)}
                                                    />
                                                    <span className="text-sm text-gray-700">{p.full_name}</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )})}
                        </div>
                    </div>
                    
                    {status && (<div className={`p-3 text-sm rounded-lg ${
                        status.type === 'success' ? 'bg-green-100 text-green-800' : status.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>{status.message}</div>)}
                    <button type="submit" disabled={isSubmitting || selectedPersonnelCodes.length === 0} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 disabled:bg-gray-400 disabled:scale-100">
                      {isSubmitting ? 'در حال ثبت...' : `ثبت ${action === 'entry' ? 'ورود' : 'خروج'} برای ${toPersianDigits(selectedPersonnelCodes.length)} نفر`}
                    </button>
                </form>
            </div>
        </div>

        {isEditModalOpen && editingLog && (
            <EditCommuteLogModal log={editingLog} guards={GUARDS} onClose={handleCloseModal} onSave={handleSaveLog} />
        )}
        {isShortLeaveModalOpen && (
            <AddShortLeaveModal members={members} guards={GUARDS} onClose={handleCloseModal} onSave={handleSaveShortLeave} />
        )}
    </div>
    );
};

export default LogCommutePage;