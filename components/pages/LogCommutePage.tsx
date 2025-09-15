import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { PencilIcon, TrashIcon, ClockIcon, ChevronDownIcon, SearchIcon, RefreshIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import HourlyCommuteModal from '../HourlyCommuteModal';

declare const XLSX: any;

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی',
];

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => 1403 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
              .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const jalaliToGregorian = (jy: number, jm: number, jd: number): [number, number, number] => {
    let j_year = jy;
    let j_month = jm;
    let j_day = jd;

    j_year += 1595;
    let days = -355668 + (365 * j_year) + (Math.floor(j_year / 33) * 8) + Math.floor(((j_year % 33) + 3) / 4) + j_day + ((j_month < 7) ? (j_month - 1) * 31 : ((j_month - 7) * 30) + 186);
    let g_year = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
        g_year += 100 * Math.floor(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    g_year += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
        g_year += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }
    let g_day = days + 1;
    const sal_a = [0, 31, ((g_year % 4 === 0 && g_year % 100 !== 0) || (g_year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let g_month = 0;
    for (; g_month < 13 && g_day > sal_a[g_month]; g_month++) {
        g_day -= sal_a[g_month];
    }

    return [g_year, g_month, g_day];
};

const LogCommutePage: React.FC = () => {
    const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
    const [logs, setLogs] = useState<CommuteLog[]>([]);
    const [selectedGuard, setSelectedGuard] = useState<string>(GUARDS[0]);
    const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());
    const [personnelSearch, setPersonnelSearch] = useState('');
    const [logSearchTerm, setLogSearchTerm] = useState('');
    
    const [actionType, setActionType] = useState<'entry' | 'exit'>('entry');

    const [logDate, setLogDate] = useState({ year: '', month: '', day: '' });
    const [viewDate, setViewDate] = useState({ year: '', month: '', day: '' });
    const [entryTime, setEntryTime] = useState({ hour: '', minute: '' });
    const [exitTime, setExitTime] = useState({ hour: '', minute: '' });

    const [loadingMembers, setLoadingMembers] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [isHourlyModalOpen, setIsHourlyModalOpen] = useState(false);
    const [selectedLogForHourly, setSelectedLogForHourly] = useState<CommuteLog | null>(null);
    const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getTodayPersian = useCallback(() => {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        });
        const parts = formatter.formatToParts(today);
        const year = parts.find(p => p.type === 'year')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        return { year, month, day };
    }, []);
    
    const updateTimeToNow = () => {
        const now = new Date();
        const currentHour = String(now.getHours());
        const currentMinute = String(now.getMinutes());
        setEntryTime({ hour: currentHour, minute: currentMinute });
        setExitTime({ hour: currentHour, minute: currentMinute });
    };

    useEffect(() => {
        const today = getTodayPersian();
        setLogDate(today);
        setViewDate(today);
        updateTimeToNow(); // Set initial time
    }, [getTodayPersian]);

    const fetchCommutingMembers = useCallback(async () => {
        try {
            setLoadingMembers(true);
            const response = await fetch('/api/personnel?type=commuting_members');
            if (!response.ok) throw new Error('خطا در دریافت لیست اعضای تردد');
            const data = await response.json();
            const members: CommutingMember[] = data.members || [];
            setCommutingMembers(members);
            const allUnits = new Set(members.map((m) => m.department || 'بدون واحد'));
            setOpenUnits(allUnits);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setLoadingMembers(false);
        }
    }, []);
    
    const fetchLogs = useCallback(async () => {
        if (!viewDate.year || !viewDate.month || !viewDate.day) return;
        try {
          setLoadingLogs(true);
          setError(null);
          const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(viewDate.year), parseInt(viewDate.month), parseInt(viewDate.day));
          const dateString = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
          const response = await fetch(`/api/commute-logs?date=${dateString}`);
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'خطا در دریافت ترددها');
          }
          const data = await response.json();
          setLogs(data.logs || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
          setLoadingLogs(false);
        }
      }, [viewDate]);
    
      useEffect(() => {
        fetchCommutingMembers();
      }, [fetchCommutingMembers]);
    
      useEffect(() => {
        fetchLogs();
      }, [fetchLogs]);

    const groupedMembers = useMemo(() => {
        const filtered = personnelSearch
            ? commutingMembers.filter(m =>
                m.full_name.toLowerCase().includes(personnelSearch.toLowerCase()) ||
                m.personnel_code.includes(personnelSearch)
            )
            : commutingMembers;

        const groups = filtered.reduce((acc, member) => {
            const department = member.department || 'بدون واحد';
            if (!acc[department]) {
                acc[department] = [];
            }
            acc[department].push(member);
            return acc;
        }, {} as Record<string, CommutingMember[]>);
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'fa'));
    }, [personnelSearch, commutingMembers]);

    const filteredLogs = useMemo(() => {
        if (!logSearchTerm.trim()) {
            return logs;
        }
        const lowercasedTerm = logSearchTerm.toLowerCase().trim();
        return logs.filter(log => 
            log.full_name?.toLowerCase().includes(lowercasedTerm) ||
            log.personnel_code.toLowerCase().includes(lowercasedTerm)
        );
    }, [logs, logSearchTerm]);

    const handlePersonnelToggle = (personnelCode: string) => {
        setSelectedPersonnel(prev => {
            const newSet = new Set(prev);
            newSet.has(personnelCode) ? newSet.delete(personnelCode) : newSet.add(personnelCode);
            return newSet;
        });
    };

    const handleUnitSelectionToggle = (unitPersonnel: CommutingMember[]) => {
        const unitCodes = unitPersonnel.map(p => p.personnel_code);
        const allSelectedInUnit = unitCodes.every(code => selectedPersonnel.has(code));
        setSelectedPersonnel(prev => {
            const newSet = new Set(prev);
            if (allSelectedInUnit) {
                unitCodes.forEach(code => newSet.delete(code));
            } else {
                unitCodes.forEach(code => newSet.add(code));
            }
            return newSet;
        });
    };

    const toggleUnitOpen = (unit: string) => {
        setOpenUnits(prev => {
            const newSet = new Set(prev);
            if (newSet.has(unit)) {
                newSet.delete(unit);
            } else {
                newSet.add(unit);
            }
            return newSet;
        });
    };
    
    const getTimestampOverride = (time: { hour: string, minute: string }) => {
        if (!logDate.year || !logDate.month || !logDate.day || !time.hour || !time.minute) return null;
        const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(logDate.year), parseInt(logDate.month), parseInt(logDate.day));
        const date = new Date(Date.UTC(gYear, gMonth - 1, gDay, parseInt(time.hour), parseInt(time.minute)));
        date.setMinutes(date.getMinutes() - 210); // Adjust for Iran's timezone offset
        return date.toISOString();
    };

    const handleSubmit = async () => {
        if (selectedPersonnel.size === 0) {
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل را انتخاب کنید.' });
            return;
        }
        
        const actionText = actionType === 'entry' ? 'ورود' : 'خروج';
        setStatus({ type: 'info', message: `در حال ثبت ${actionText}...` });
        
        const timestampOverride = getTimestampOverride(actionType === 'entry' ? entryTime : exitTime);
        
        let successCount = 0;
        for (const personnelCode of selectedPersonnel) {
            try {
                const response = await fetch('/api/commute-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personnelCode, guardName: selectedGuard, action: actionType, timestampOverride })
                });
                if (response.ok) {
                    successCount++;
                } else {
                    const errorData = await response.json();
                    // Optionally show individual errors, for now, we just count success
                    console.error(`Failed for ${personnelCode}:`, errorData.error);
                }
            } catch (err) {
                 console.error(`Request failed for ${personnelCode}:`, err);
            }
        }
        
        setStatus({ type: 'success', message: `${actionText} برای ${toPersianDigits(successCount)} نفر با موفقیت ثبت شد.` });
        setSelectedPersonnel(new Set());
        fetchLogs();
        setTimeout(() => setStatus(null), 5000);
    };

    const handleEditClick = (log: CommuteLog) => {
        setEditingLog(log);
        setIsEditModalOpen(true);
    };

    const handleHourlyClick = (log: CommuteLog) => {
        setSelectedLogForHourly(log);
        setIsHourlyModalOpen(true);
    };

    const handleDeleteLog = async (id: number) => {
        if (window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) {
            try {
                const response = await fetch('/api/commute-logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
                if (!response.ok) throw new Error((await response.json()).error);
                setStatus({ type: 'success', message: 'رکورد با موفقیت حذف شد.' });
                fetchLogs();
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
        }
    };
    
    const handleSaveLog = async (updatedLog: CommuteLog) => {
        try {
            const response = await fetch('/api/commute-logs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedLog) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: 'رکورد با موفقیت ویرایش شد.' });
            fetchLogs();
            setIsEditModalOpen(false);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleDownloadSample = () => {
        const headers = ['نام', 'کد', 'واحد', 'سمت', 'تاریخ', 'ورود', 'خروج', 'شیفت', 'تاخیر', 'تعجیل', 'مدت ماموریت'];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
        XLSX.writeFile(wb, 'Sample_Commute_Logs_Detailed.xlsx');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });

                const mappedData = json.map(row => {
                    const dateStr = toEnglishDigits(String(row['تاریخ'] || ''));
                    const entryTimeStr = toEnglishDigits(String(row['ورود'] || ''));
                    const exitTimeStr = toEnglishDigits(String(row['خروج'] || ''));
                    const personnelCodeStr = toEnglishDigits(String(row['کد'] || ''));

                    const dateParts = dateStr.split(/[\/-]/).map(p => parseInt(p, 10));
                    if (dateParts.length !== 3 || dateParts.some(isNaN)) return null;

                    const [gYear, gMonth, gDay] = jalaliToGregorian(dateParts[0], dateParts[1], dateParts[2]);

                    let entryTimestamp = null;
                    if (entryTimeStr) {
                        const entryTimeParts = entryTimeStr.split(':').map(p => parseInt(p, 10));
                        if (entryTimeParts.length >= 2 && !entryTimeParts.some(isNaN)) {
                            const localDate = new Date(gYear, gMonth - 1, gDay, entryTimeParts[0], entryTimeParts[1]);
                            entryTimestamp = localDate.toISOString();
                        }
                    }

                    let exitTimestamp = null;
                    if (exitTimeStr) {
                        const exitTimeParts = exitTimeStr.split(':').map(p => parseInt(p, 10));
                        if (exitTimeParts.length >= 2 && !exitTimeParts.some(isNaN)) {
                            const localDate = new Date(gYear, gMonth - 1, gDay, exitTimeParts[0], exitTimeParts[1]);
                            exitTimestamp = localDate.toISOString();
                        }
                    }

                    return {
                        personnel_code: personnelCodeStr,
                        guard_name: String(row['شیفت'] || selectedGuard),
                        entry_time: entryTimestamp,
                        exit_time: exitTimestamp,
                    };
                }).filter(log => log && log.personnel_code && log.entry_time);

                if (mappedData.length === 0) throw new Error('هیچ رکورد معتبری در فایل یافت نشد. لطفاً فرمت تاریخ (مثال: ۱۴۰۴/۰۶/۱۱)، ساعت (مثال: ۰۹:۰۰)، و وجود کد پرسنلی و ساعت ورود را بررسی کنید.');

                const response = await fetch('/api/commute-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData),
                });

                const resData = await response.json();
                if (!response.ok) throw new Error(resData.details || resData.error || 'خطا در ورود اطلاعات');
                
                setStatus({ type: 'success', message: resData.message });
                fetchLogs();
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل' });
            } finally {
                if(fileInputRef.current) fileInputRef.current.value = "";
                setTimeout(() => setStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '---';
        return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Column: Form */}
        <div className="lg:col-span-5 bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">ثبت تردد</h2>
          {status && <div className={`p-3 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">شیفت کاری</label>
              <div className="grid grid-cols-1 gap-2">
                {GUARDS.map(guard => (
                  <label key={guard} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${selectedGuard === guard ? 'bg-blue-100 border-blue-500' : 'bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700'}`}>
                    <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={e => setSelectedGuard(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500"/>
                    <span className="mr-3 text-sm">{guard}</span>
                  </label>
                ))}
              </div>
            </div>

             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">نوع عملیات</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                    <button type="button" onClick={() => setActionType('entry')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${actionType === 'entry' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-gray-600 dark:text-slate-300'}`}>
                        ثبت ورود
                    </button>
                    <button type="button" onClick={() => setActionType('exit')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${actionType === 'exit' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-gray-600 dark:text-slate-300'}`}>
                        ثبت خروج
                    </button>
                </div>
            </div>
            
             <div className="border rounded-lg p-4 space-y-3 bg-slate-50 dark:bg-slate-900/20 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold dark:text-slate-200">ثبت تاریخ و زمان</h3>
                    <button
                        type="button"
                        onClick={updateTimeToNow}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded-full"
                        title="بروزرسانی ساعت به زمان حال"
                    >
                        <RefreshIcon className="w-5 h-5" />
                    </button>
                </div>
               <div className="grid grid-cols-3 gap-2">
                <select value={logDate.day} onChange={e => setLogDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                <select value={logDate.month} onChange={e => setLogDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                <select value={logDate.year} onChange={e => setLogDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={actionType === 'exit' ? 'opacity-50' : ''}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">ساعت ورود</label>
                      <div className="grid grid-cols-2 gap-2">
                          <select value={entryTime.hour} onChange={e => setEntryTime(p => ({...p, hour: e.target.value}))} disabled={actionType === 'exit'} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                          <select value={entryTime.minute} onChange={e => setEntryTime(p => ({...p, minute: e.target.value}))} disabled={actionType === 'exit'} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                      </div>
                  </div>
                  <div className={actionType === 'entry' ? 'opacity-50' : ''}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">ساعت خروج</label>
                      <div className="grid grid-cols-2 gap-2">
                          <select value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} disabled={actionType === 'entry'} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                          <select value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} disabled={actionType === 'entry'} className="w-full p-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 rounded-md font-sans"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                      </div>
                  </div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={selectedPersonnel.size === 0} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {actionType === 'entry' ? 'ثبت ورود' : 'ثبت خروج'} برای {toPersianDigits(selectedPersonnel.size)} نفر
            </button>
            
            <div className="border dark:border-slate-700 rounded-lg">
                <div className="p-4 border-b dark:border-slate-700">
                     <h3 className="font-semibold dark:text-slate-200">انتخاب پرسنل ({toPersianDigits(selectedPersonnel.size)} نفر)</h3>
                     <input type="text" placeholder="جستجوی پرسنل..." value={personnelSearch} onChange={e => setPersonnelSearch(e.target.value)} className="w-full mt-2 p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"/>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                    {groupedMembers.map(([unit, members]) => {
                        const allInUnitSelected = members.every(m => selectedPersonnel.has(m.personnel_code));
                        return (
                            <div key={unit} className="mb-2">
                                <div className="w-full flex justify-between items-center p-2 bg-gray-100 dark:bg-slate-700/50 rounded-md">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={allInUnitSelected} onChange={() => handleUnitSelectionToggle(members)} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                                        <span className="font-semibold text-sm">{unit}</span>
                                    </label>
                                    <button type="button" onClick={() => toggleUnitOpen(unit)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600">
                                        <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${openUnits.has(unit) ? '' : '-rotate-90'}`} />
                                    </button>
                                </div>
                                <div className={`pr-4 mt-1 space-y-1 overflow-hidden transition-all ease-in-out duration-300 ${openUnits.has(unit) ? 'max-h-96' : 'max-h-0'}`}>
                                    {members.map(member => (
                                        <label key={member.personnel_code} className="flex items-center p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                            <input type="checkbox" checked={selectedPersonnel.has(member.personnel_code)} onChange={() => handlePersonnelToggle(member.personnel_code)} className="ml-2 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/>
                                            <div className="flex flex-col">
                                                <span className="text-sm">{member.full_name}</span>
                                                <span className="text-xs text-gray-500 dark:text-slate-400 font-sans tracking-wider">کد: {toPersianDigits(member.personnel_code)}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            <button onClick={handleSubmit} disabled={selectedPersonnel.size === 0} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {actionType === 'entry' ? 'ثبت ورود' : 'ثبت خروج'} برای {toPersianDigits(selectedPersonnel.size)} نفر
            </button>
          </div>
        </div>
        
        {/* Left Column: Logs */}
        <div className="lg:col-span-7 bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
             <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">ترددهای ثبت شده در تاریخ</h2>
             <div className="grid grid-cols-3 gap-2">
                <select value={viewDate.day} onChange={e => setViewDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 dark:bg-slate-700 dark:border-slate-600 font-sans">
                    {DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}
                </select>
                <select value={viewDate.month} onChange={e => setViewDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 dark:bg-slate-700 dark:border-slate-600 font-sans">
                    {PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
                <select value={viewDate.year} onChange={e => setViewDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 dark:bg-slate-700 dark:border-slate-600 font-sans">
                    {YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
                </select>
             </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="جستجو در لیست روزانه (نام یا کد پرسنلی)..."
                  value={logSearchTerm}
                  onChange={e => setLogSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleDownloadSample} className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200 transition-colors">دانلود نمونه</button>
                <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-logs" />
                <label htmlFor="excel-import-logs" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">ورود از اکسل</label>
            </div>
          </div>
          <div className="overflow-x-auto border dark:border-slate-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">پرسنل</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">شیفت کاری</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">ورود</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">خروج</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                {loadingLogs ? <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr> :
                 filteredLogs.length === 0 ? <tr><td colSpan={5} className="text-center p-4 text-gray-500">{logSearchTerm ? 'موردی با این مشخصات یافت نشد.' : 'هیچ ترددی برای این روز ثبت نشده است.'}</td></tr> :
                 filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900 dark:text-slate-200">{log.full_name}</div><div className="text-xs text-gray-500 dark:text-slate-400">کد: {toPersianDigits(log.personnel_code)}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-slate-300">{log.guard_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-slate-300 tabular-nums">{formatTime(log.entry_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-slate-300 tabular-nums">{formatTime(log.exit_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center justify-center gap-1">
                           <button onClick={() => handleHourlyClick(log)} className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md" title="تردد ساعتی"><ClockIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleEditClick(log)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md" title="ویرایش"><PencilIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-md" title="حذف"><TrashIcon className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </tr>
                 ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isEditModalOpen && editingLog && (
        <EditCommuteLogModal log={editingLog} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveLog} />
      )}
      {isHourlyModalOpen && selectedLogForHourly && (
        <HourlyCommuteModal
            log={selectedLogForHourly}
            guardName={selectedGuard}
            date={viewDate}
            onClose={() => setIsHourlyModalOpen(false)}
        />
      )}
    </>
  );
};

export default LogCommutePage;
