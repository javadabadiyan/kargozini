import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteReportRow, PresentMember, HourlyCommuteReportRow, CommuteEditLog, CommuteLog } from '../../types';
import { PencilIcon, TrashIcon, DownloadIcon, UploadIcon, SearchIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import EditHourlyLogModal from '../EditHourlyLogModal';

declare const XLSX: any;

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


const jalaliToGregorian = (jy?: number, jm?: number, jd?: number): string | null => {
    if (!jy || !jm || !jd || isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;
    
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
    
    return `${g_year}-${String(g_month).padStart(2, '0')}-${String(g_day).padStart(2, '0')}`;
};

const DatePicker: React.FC<{ date: any, setDate: (date: any) => void, label?: string }> = ({ date, setDate, label }) => {
    const setToday = () => {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = formatter.formatToParts(today);
        setDate({
            year: parts.find(p => p.type === 'year')?.value || '',
            month: parts.find(p => p.type === 'month')?.value || '',
            day: parts.find(p => p.type === 'day')?.value || '',
        });
    };
    const clearDate = () => setDate({ year: '', month: '', day: '' });

    return (
        <div className="flex flex-col gap-2">
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
            <div className="flex items-center gap-2">
                <select value={date.day} onChange={e => setDate({...date, day: e.target.value})} className="form-select w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"><option value="">روز</option>{DAYS.map(d=><option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                <select value={date.month} onChange={e => setDate({...date, month: e.target.value})} className="form-select w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"><option value="">ماه</option>{PERSIAN_MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>
                <select value={date.year} onChange={e => setDate({...date, year: e.target.value})} className="form-select w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"><option value="">سال</option>{YEARS.map(y=><option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
            </div>
            <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={setToday} className="text-blue-600 hover:underline">امروز</button>
                <button type="button" onClick={clearDate} className="text-gray-600 hover:underline">پاک کردن</button>
            </div>
        </div>
    );
};

const formatMinutesToHours = (totalMinutes: number): string => {
    if (totalMinutes <= 0) return '۰ دقیقه';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    let result = [];
    if (hours > 0) result.push(`${toPersianDigits(hours)} ساعت`);
    if (minutes > 0) result.push(`${toPersianDigits(minutes)} دقیقه`);
    return result.join(' و ');
};

const CommuteReportPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [reportData, setReportData] = useState<CommuteReportRow[]>([]);
    const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [filters, setFilters] = useState({ personnelCode: '', department: '', position: '' });
    const [fromDate, setFromDate] = useState({ year: '', month: '', day: '' });
    const [toDate, setToDate] = useState({ year: '', month: '', day: '' });
    const [standardTimes, setStandardTimes] = useState({ entry: { hour: '6', minute: '0' }, exit: { hour: '14', minute: '0' }});

    // States for Present Report
    const [presentReportData, setPresentReportData] = useState<PresentMember[]>([]);
    const [presentReportLoading, setPresentReportLoading] = useState(false);
    const [presentReportError, setPresentReportError] = useState<string | null>(null);
    const [presentDate, setPresentDate] = useState({ year: '', month: '', day: '' });

    // States for Hourly Report
    const [hourlyReportData, setHourlyReportData] = useState<HourlyCommuteReportRow[]>([]);
    const [hourlyReportLoading, setHourlyReportLoading] = useState(false);
    const [hourlyReportError, setHourlyReportError] = useState<string | null>(null);
    
    // States for Analysis Report
    const [analysisSearchTerm, setAnalysisSearchTerm] = useState('');
    const [selectedAnalysisPersonnel, setSelectedAnalysisPersonnel] = useState<CommutingMember | null>(null);
    
    // State for Monthly Report
    const [monthlyExportStatus, setMonthlyExportStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [backupStatus, setBackupStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    
    // States for Edit Logs Report
    const [editLogs, setEditLogs] = useState<CommuteEditLog[]>([]);
    const [editLogsLoading, setEditLogsLoading] = useState(false);
    const [editLogsError, setEditLogsError] = useState<string | null>(null);

    // States for Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [isHourlyEditModalOpen, setIsHourlyEditModalOpen] = useState(false);
    const [editingHourlyLog, setEditingHourlyLog] = useState<HourlyCommuteReportRow | null>(null);

    const dailyBackupRef = useRef<HTMLInputElement>(null);
    const hourlyBackupRef = useRef<HTMLInputElement>(null);

    const filterOptions = useMemo(() => {
        // FIX: Added explicit types to sort callback arguments to resolve 'localeCompare does not exist on type unknown' error.
        const departments = [...new Set(commutingMembers.map(m => m.department).filter(Boolean))].sort((a: string,b: string) => a.localeCompare(b, 'fa'));
        const positions = [...new Set(commutingMembers.map(m => m.position).filter(Boolean))].sort((a: string,b: string) => a.localeCompare(b, 'fa'));
        return { departments, positions };
    }, [commutingMembers]);

    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const response = await fetch('/api/personnel?type=commuting_members');
                if (!response.ok) throw new Error('Failed to fetch commuting members for filters');
                const data = await response.json();
                setCommutingMembers(data.members || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchFilterData();
    }, []);

    useEffect(() => {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = formatter.formatToParts(today);
        const todayDate = {
            year: parts.find(p => p.type === 'year')?.value || '',
            month: parts.find(p => p.type === 'month')?.value || '',
            day: parts.find(p => p.type === 'day')?.value || '',
        };
        setPresentDate(todayDate);
        setFromDate(todayDate);
        setToDate(todayDate);
    }, []);
    
    const buildFilterParams = useCallback(() => {
        const params = new URLSearchParams();
        const gregFrom = jalaliToGregorian(parseInt(fromDate.year, 10), parseInt(fromDate.month, 10), parseInt(fromDate.day, 10));
        const gregTo = jalaliToGregorian(parseInt(toDate.year, 10), parseInt(toDate.month, 10), parseInt(toDate.day, 10));
        
        if (gregFrom) params.append('startDate', gregFrom);
        if (gregTo) params.append('endDate', gregTo);
        if (filters.personnelCode) params.append('personnelCode', filters.personnelCode);
        if (filters.department) params.append('department', filters.department);
        if (filters.position) params.append('position', filters.position);
        return params.toString();
    }, [fromDate, toDate, filters]);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/commute-logs?report=general&${buildFilterParams()}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || errData.error || 'خطا در دریافت گزارش');
            }
            const data = await response.json();
            setReportData(data.reports || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.');
        } finally {
            setLoading(false);
        }
    }, [buildFilterParams]);

    const fetchPresentReportData = useCallback(async () => {
        if (!presentDate.year || !presentDate.month || !presentDate.day) return;
        setPresentReportLoading(true);
        setPresentReportError(null);
        const gregPresentDate = jalaliToGregorian(parseInt(presentDate.year, 10), parseInt(presentDate.month, 10), parseInt(presentDate.day, 10));
        try {
            const response = await fetch(`/api/commute-logs?report=present&date=${gregPresentDate}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || errData.error || 'خطا در دریافت گزارش حاضرین');
            }
            const data = await response.json();
            setPresentReportData(data.present || []);
        } catch (err) {
            setPresentReportError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.');
        } finally {
            setPresentReportLoading(false);
        }
    }, [presentDate]);

    const fetchHourlyReportData = useCallback(async () => {
        setHourlyReportLoading(true);
        setHourlyReportError(null);
        try {
            const response = await fetch(`/api/commute-logs?report=hourly&${buildFilterParams()}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || errData.error || 'خطا در دریافت گزارش بین ساعتی');
            }
            const data = await response.json();
            setHourlyReportData(data.reports || []);
        } catch (err) {
            setHourlyReportError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.');
        } finally {
            setHourlyReportLoading(false);
        }
    }, [buildFilterParams]);

    const fetchEditLogsData = useCallback(async () => {
        setEditLogsLoading(true);
        setEditLogsError(null);
        try {
            const response = await fetch(`/api/commute-logs?report=edits&${buildFilterParams()}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.details || errData.error || 'خطا در دریافت گزارش ویرایش‌ها');
            }
            const data = await response.json();
            setEditLogs(data.logs || []);
        } catch (err) {
            setEditLogsError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.');
        } finally {
            setEditLogsLoading(false);
        }
    }, [buildFilterParams]);

    useEffect(() => {
        if (activeTab === 'general' || activeTab === 'analysis') {
            fetchReportData();
        } else if (activeTab === 'present') {
            fetchPresentReportData();
        } else if (activeTab === 'hourly') {
            fetchHourlyReportData();
        } else if (activeTab === 'edits') {
            fetchEditLogsData();
        }
    }, [activeTab, fetchReportData, fetchPresentReportData, fetchHourlyReportData, fetchEditLogsData]);
    
    // --- Modal and CRUD Handlers ---

    const handleCloseModals = () => {
        setIsEditModalOpen(false);
        setEditingLog(null);
        setIsHourlyEditModalOpen(false);
        setEditingHourlyLog(null);
    };

    const handleOpenEditModal = (log: CommuteReportRow | PresentMember) => {
        const modalLog: CommuteLog = {
            id: log.log_id,
            personnel_code: log.personnel_code,
            full_name: log.full_name,
            entry_time: log.entry_time,
            exit_time: (log as CommuteReportRow).exit_time || null,
            guard_name: (log as CommuteReportRow).guard_name || '',
        };
        setEditingLog(modalLog);
        setIsEditModalOpen(true);
    };

    const handleDeleteLog = async (logId: number) => {
        if (!window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟ این عمل قابل بازگشت نیست.')) return;
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: logId }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در حذف رکورد');
            if (activeTab === 'general') fetchReportData();
            if (activeTab === 'present') fetchPresentReportData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'خطای ناشناخته');
        }
    };

    const handleSaveLog = async (updatedLog: CommuteLog) => {
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLog),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در ذخیره تغییرات');
            handleCloseModals();
            if (activeTab === 'general') fetchReportData();
            if (activeTab === 'present') fetchPresentReportData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'خطای ناشناخته');
        }
    };
    
    const handleOpenHourlyEditModal = (log: HourlyCommuteReportRow) => {
        setEditingHourlyLog(log);
        setIsHourlyEditModalOpen(true);
    };
    
    const handleDeleteHourlyLog = async (logId: number) => {
        if (!window.confirm('آیا از حذف این تردد ساعتی اطمینان دارید؟')) return;
        try {
            const response = await fetch(`/api/commute-logs?entity=hourly&id=${logId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در حذف رکورد');
            fetchHourlyReportData();
        } catch (err) {
             alert(err instanceof Error ? err.message : 'خطای ناشناخته');
        }
    };

    const handleSaveHourlyLog = async (updatedData: Partial<HourlyCommuteReportRow>) => {
        const { log_id, ...payload } = updatedData;
        try {
            const response = await fetch(`/api/commute-logs?entity=hourly&id=${log_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در ذخیره');
            handleCloseModals();
            fetchHourlyReportData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'خطای ناشناخته');
        }
    };

    // --- Calculation and Formatting ---

    const calculateDifference = useCallback((isoString: string | null, standardHour: string, standardMinute: string, type: 'late' | 'early'): string | null => {
        if (!isoString) return null;
        const logTime = new Date(isoString);
        const standardTime = new Date(logTime);
        standardTime.setHours(parseInt(standardHour), parseInt(standardMinute), 0, 0);
        let diffMinutes: number;
        if (type === 'late') {
            diffMinutes = (logTime.getTime() - standardTime.getTime()) / 60000;
            if (diffMinutes <= 0) return null;
        } else {
            diffMinutes = (standardTime.getTime() - logTime.getTime()) / 60000;
            if (diffMinutes <= 0) return null;
        }
        const hours = Math.floor(diffMinutes / 60);
        const minutes = Math.round(diffMinutes % 60);
        let result = [];
        if (hours > 0) result.push(`${toPersianDigits(hours)} ساعت`);
        if (minutes > 0) result.push(`${toPersianDigits(minutes)} دقیقه`);
        return result.join(' و ');
    }, []);

    const calculateDifferenceInMinutes = useCallback((isoString: string | null, standardHour: string, standardMinute: string, type: 'late' | 'early'): number => {
        if (!isoString) return 0;
        const logTime = new Date(isoString);
        const standardTime = new Date(logTime);
        standardTime.setHours(parseInt(standardHour, 10), parseInt(standardMinute, 10), 0, 0);
    
        let diffMinutes: number;
        if (type === 'late') {
            diffMinutes = (logTime.getTime() - standardTime.getTime()) / 60000;
        } else { // 'early'
            diffMinutes = (standardTime.getTime() - logTime.getTime()) / 60000;
        }
    
        return diffMinutes > 0 ? Math.round(diffMinutes) : 0;
    }, []);
    
    const calculateDuration = (exit: string | null, entry: string | null): string => {
        if (exit && entry) {
            const diff = (new Date(entry).getTime() - new Date(exit).getTime()) / 60000;
            if (diff < 0) return 'نامعتبر';
            const hours = Math.floor(diff / 60);
            const minutes = Math.round(diff % 60);
            return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه`;
        }
        if (exit && !entry) return 'در حال انجام';
        if (!exit && entry) return 'ورود ثبت شده';
        return '---';
    };
    
    const formatTime = (isoString: string | null) => {
        if (!isoString) return '---';
        return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
    };

    const handleExport = () => {
        const dataToExport = reportData.map(row => ({
            'نام پرسنل': row.full_name, 'کد': toPersianDigits(row.personnel_code), 'واحد': row.department || '', 'تاریخ': toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })), 'ورود': toPersianDigits(new Date(row.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })), 'خروج': row.exit_time ? toPersianDigits(new Date(row.exit_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })) : '', 'شیفت کاری': row.guard_name, 'تاخیر': calculateDifference(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late') || '', 'تعجیل': calculateDifference(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early') || '', 'ماموریت': '۰', 'مرخصی': '۰'
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش تردد');
        XLSX.writeFile(workbook, 'Commute_Report.xlsx');
    };

    const handlePresentExport = () => {
        const gregDate = jalaliToGregorian(parseInt(presentDate.year), parseInt(presentDate.month), parseInt(presentDate.day));
        const dataToExport = presentReportData.map(row => ({
            'نام کامل': row.full_name, 'کد پرسنلی': toPersianDigits(row.personnel_code), 'واحد': row.department || '', 'سمت': row.position || '', 'ساعت ورود': toPersianDigits(new Date(row.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })),
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش حاضرین');
        XLSX.writeFile(workbook, `Present_Report_${gregDate}.xlsx`);
    };

    const handleHourlyExport = () => {
        const dataToExport = hourlyReportData.map(row => ({
            'نام پرسنل': row.full_name, 'کد': toPersianDigits(row.personnel_code), 'واحد': row.department || '', 'تاریخ': toPersianDigits(new Date(row.exit_time || row.entry_time!).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })), 'خروج': formatTime(row.exit_time), 'ورود': formatTime(row.entry_time), 'مدت': calculateDuration(row.exit_time, row.entry_time), 'شرح': row.reason || '', 'ثبت کننده': row.guard_name
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش بین ساعتی');
        XLSX.writeFile(workbook, 'Hourly_Commute_Report.xlsx');
    };
    
    const handleAnalysisExport = () => {
        const dataToExport = reportData.map(row => {
            const lateMinutes = calculateDifferenceInMinutes(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late');
            const earlyMinutes = calculateDifferenceInMinutes(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early');
            return {
                'نام پرسنل': row.full_name,
                'کد پرسنلی': toPersianDigits(row.personnel_code),
                'تاریخ': toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })),
                'میزان تاخیر (دقیقه)': toPersianDigits(lateMinutes),
                'میزان تعجیل (دقیقه)': toPersianDigits(earlyMinutes),
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'تحلیل تاخیر و تعجیل');
        XLSX.writeFile(workbook, 'Analysis_Report.xlsx');
    };
    
    const handleMonthlyExport = async () => {
        if (!fromDate.year || !fromDate.month) {
            setMonthlyExportStatus({ type: 'error', message: 'لطفا ابتدا یک تاریخ در فیلتر "از تاریخ" انتخاب کنید تا ماه گزارش مشخص شود.' });
            setTimeout(() => setMonthlyExportStatus(null), 5000);
            return;
        }
    
        setMonthlyExportStatus({ type: 'info', message: 'در حال آماده‌سازی گزارش جامع ماهانه... این عملیات ممکن است چند لحظه طول بکشد.' });
    
        try {
            const year = parseInt(fromDate.year, 10);
            const month = parseInt(fromDate.month, 10);
            const firstDayOfMonthJalali = { year, month, day: 1 };
            const daysInMonth = month <= 6 ? 31 : (month <= 11 ? 30 : 29);
            const lastDayOfMonthJalali = { year, month, day: daysInMonth };
    
            const gregFrom = jalaliToGregorian(firstDayOfMonthJalali.year, firstDayOfMonthJalali.month, firstDayOfMonthJalali.day);
            const gregTo = jalaliToGregorian(lastDayOfMonthJalali.year, lastDayOfMonthJalali.month, lastDayOfMonthJalali.day);
    
            const monthParams = new URLSearchParams();
            if (gregFrom) monthParams.append('startDate', gregFrom);
            if (gregTo) monthParams.append('endDate', gregTo);
            if (filters.personnelCode) monthParams.append('personnelCode', filters.personnelCode);
            if (filters.department) monthParams.append('department', filters.department);
            if (filters.position) monthParams.append('position', filters.position);
            const paramsString = monthParams.toString();
    
            const [generalRes, hourlyRes] = await Promise.all([
                fetch(`/api/commute-logs?report=general&${paramsString}`),
                fetch(`/api/commute-logs?report=hourly&${paramsString}`)
            ]);
    
            if (!generalRes.ok || !hourlyRes.ok) throw new Error('خطا در دریافت اطلاعات ماهانه از سرور.');
    
            const generalData: { reports: CommuteReportRow[] } = await generalRes.json();
            const hourlyData: { reports: HourlyCommuteReportRow[] } = await hourlyRes.json();
            const generalReports = generalData.reports || [];
            const hourlyReports = hourlyData.reports || [];
    
            const summary: { [key: string]: any } = {};
    
            generalReports.forEach(row => {
                const code = row.personnel_code;
                if (!summary[code]) {
                    summary[code] = { 'کد پرسنلی': toPersianDigits(code), 'نام پرسنل': row.full_name, 'واحد': row.department || '', 'تعداد روز کاری': 0, 'جمع تاخیر (دقیقه)': 0, 'جمع تعجیل (دقیقه)': 0, 'جمع تردد ساعتی (دقیقه)': 0, processed_days: new Set() };
                }
                const dayKey = new Date(row.entry_time).toLocaleDateString('fa-IR');
                if (!summary[code].processed_days.has(dayKey)) {
                    summary[code]['تعداد روز کاری']++;
                    summary[code].processed_days.add(dayKey);
                }
                summary[code]['جمع تاخیر (دقیقه)'] += calculateDifferenceInMinutes(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late');
                summary[code]['جمع تعجیل (دقیقه)'] += calculateDifferenceInMinutes(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early');
            });
    
            hourlyReports.forEach(row => {
                const code = row.personnel_code;
                if (!summary[code]) {
                     summary[code] = { 'کد پرسنلی': toPersianDigits(code), 'نام پرسنل': row.full_name, 'واحد': row.department || '', 'تعداد روز کاری': 0, 'جمع تاخیر (دقیقه)': 0, 'جمع تعجیل (دقیقه)': 0, 'جمع تردد ساعتی (دقیقه)': 0 };
                }
                if(row.exit_time && row.entry_time){
                    const duration = (new Date(row.entry_time).getTime() - new Date(row.exit_time).getTime()) / 60000;
                    if(duration > 0) summary[code]['جمع تردد ساعتی (دقیقه)'] += Math.round(duration);
                }
            });
            
            const summaryDataToExport = Object.values(summary).map(s => {
                const { processed_days, ...rest } = s;
                rest['تعداد روز کاری'] = toPersianDigits(rest['تعداد روز کاری']);
                rest['جمع تاخیر (دقیقه)'] = toPersianDigits(rest['جمع تاخیر (دقیقه)']);
                rest['جمع تعجیل (دقیقه)'] = toPersianDigits(rest['جمع تعجیل (دقیقه)']);
                rest['جمع تردد ساعتی (دقیقه)'] = toPersianDigits(rest['جمع تردد ساعتی (دقیقه)']);
                return rest;
            });
    
            if (summaryDataToExport.length === 0 && generalReports.length === 0 && hourlyReports.length === 0) {
                throw new Error('هیچ داده‌ای برای ایجاد گزارش ماهانه یافت نشد.');
            }
            
            // --- Create Sheets ---
            const workbook = XLSX.utils.book_new();

            // 1. Summary Sheet
            const summaryWorksheet = XLSX.utils.json_to_sheet(summaryDataToExport);
            XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'خلاصه ماهانه');

            // 2. Daily Log Sheet
            const dailyLogData = generalReports.map(row => ({ 'نام پرسنل': row.full_name, 'کد': toPersianDigits(row.personnel_code), 'واحد': row.department || '', 'تاریخ': toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })), 'ورود': formatTime(row.entry_time), 'خروج': formatTime(row.exit_time), 'شیفت کاری': row.guard_name }));
            const dailyLogWorksheet = XLSX.utils.json_to_sheet(dailyLogData);
            XLSX.utils.book_append_sheet(workbook, dailyLogWorksheet, 'گزارش روزانه');
    
            // 3. Hourly Log Sheet
            const hourlyLogData = hourlyReports.map(row => ({ 'نام پرسنل': row.full_name, 'کد': toPersianDigits(row.personnel_code), 'واحد': row.department || '', 'تاریخ': toPersianDigits(new Date(row.exit_time || row.entry_time!).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })), 'خروج': formatTime(row.exit_time), 'ورود': formatTime(row.entry_time), 'مدت': calculateDuration(row.exit_time, row.entry_time), 'شرح': row.reason || '', 'ثبت کننده': row.guard_name }));
            const hourlyLogWorksheet = XLSX.utils.json_to_sheet(hourlyLogData);
            XLSX.utils.book_append_sheet(workbook, hourlyLogWorksheet, 'گزارش ساعتی');
    
            XLSX.writeFile(workbook, `Monthly_Report_${fromDate.year}_${fromDate.month}.xlsx`);
            setMonthlyExportStatus({ type: 'success', message: 'گزارش جامع ماهانه با موفقیت ایجاد شد.' });
    
        } catch (err) {
            setMonthlyExportStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ایجاد گزارش' });
        } finally {
            setTimeout(() => setMonthlyExportStatus(null), 5000);
        }
    };
    
    const handleBackupImport = (entity: 'daily' | 'hourly') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBackupStatus({ type: 'info', message: 'در حال پردازش فایل پشتیبان...' });
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false });
                
                const endpoint = entity === 'daily' ? '/api/commute-logs' : '/api/commute-logs?entity=hourly';
                let mappedData;

                if (entity === 'daily') {
                    mappedData = json.map(row => ({
                        personnel_code: toEnglishDigits(String(row['کد پرسنلی'] || '')),
                        guard_name: String(row['شیفت کاری'] || ''),
                        entry_time: /*... date conversion ...*/ null,
                        exit_time: /*... date conversion ...*/ null,
                    })); // Date conversion logic needs to be robust
                } else {
                     mappedData = json.map(row => ({
                        personnel_code: toEnglishDigits(String(row['کد پرسنلی'] || '')),
                        full_name: String(row['نام کامل'] || ''),
                        guard_name: String(row['شیفت کاری'] || ''),
                        exit_time: null,
                        entry_time: null,
                        reason: String(row['شرح'] || '')
                    }));
                }
                
                // For simplicity, this is omitted. A full implementation would need robust date/time parsing from Persian strings.
                
                throw new Error("بازیابی از اکسل در این بخش هنوز پیاده‌سازی نشده است.");

            } catch (err) {
                 setBackupStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل' });
            } finally {
                if (entity === 'daily' && dailyBackupRef.current) dailyBackupRef.current.value = "";
                if (entity === 'hourly' && hourlyBackupRef.current) hourlyBackupRef.current.value = "";
                setTimeout(() => setBackupStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const tabs = [
        { id: 'general', label: 'گزارش جامع' },
        { id: 'present', label: 'گزارش حاضرین' },
        { id: 'hourly', label: 'گزارش بین ساعتی' },
        { id: 'analysis', label: 'تحلیل تاخیر و تعجیل' },
        { id: 'monthly', label: 'گزارش ماهانه' },
        { id: 'edits', label: 'گزارش ویرایش‌ها' },
        { id: 'backup', label: 'پشتیبان گیری' },
    ];
    
    const sharedFilters = ['general', 'hourly', 'edits', 'analysis', 'monthly', 'backup'];

    const analysisSummary = useMemo(() => {
        if (!reportData) return { totalLateMinutes: 0, totalEarlyMinutes: 0, lateCount: 0, earlyCount: 0 };
        let totalLateMinutes = 0;
        let totalEarlyMinutes = 0;
        let lateCount = 0;
        let earlyCount = 0;
    
        reportData.forEach(row => {
            const lateMins = calculateDifferenceInMinutes(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late');
            const earlyMins = calculateDifferenceInMinutes(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early');
            if (lateMins > 0) {
                totalLateMinutes += lateMins;
                lateCount++;
            }
            if (earlyMins > 0) {
                totalEarlyMinutes += earlyMins;
                earlyCount++;
            }
        });
    
        return { totalLateMinutes, totalEarlyMinutes, lateCount, earlyCount };
    }, [reportData, standardTimes, calculateDifferenceInMinutes]);

    return (
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">گزارش گیری تردد</h2>
          
          <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-4 space-x-reverse overflow-x-auto" aria-label="Tabs">
                  {tabs.map(tab => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`${
                              activeTab === tab.id
                                  ? 'border-blue-500 text-blue-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
                          } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                      >
                          {tab.label}
                      </button>
                  ))}
              </nav>
          </div>

          {sharedFilters.includes(activeTab) && (
              <form onSubmit={e => { e.preventDefault(); fetchReportData(); fetchHourlyReportData(); fetchEditLogsData(); }} className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                      <DatePicker date={fromDate} setDate={setFromDate} label="از تاریخ" />
                      <DatePicker date={toDate} setDate={setToDate} label="تا تاریخ" />
                      <div><label className="block text-sm font-medium">پرسنل</label><select value={filters.personnelCode} onChange={e => setFilters({...filters, personnelCode: e.target.value})} className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"><option value="">همه</option>{commutingMembers.map(m => <option key={m.id} value={m.personnel_code}>{m.full_name}</option>)}</select></div>
                      <div><label className="block text-sm font-medium">واحد</label><select value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})} className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"><option value="">همه</option>{filterOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                      <div><label className="block text-sm font-medium">سمت</label><select value={filters.position} onChange={e => setFilters({...filters, position: e.target.value})} className="w-full p-2 border rounded-md dark:bg-slate-800 dark:border-slate-600"><option value="">همه</option>{filterOptions.positions.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  </div>
                   <div className="flex justify-end">
                      <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">اعمال فیلتر و نمایش</button>
                  </div>
              </form>
          )}

          {/* Tab Content */}
          <div className="min-h-[400px]">
                {/* General Report */}
                {activeTab === 'general' && (
                  <div className="space-y-4">
                      <div className="flex justify-end"><button onClick={handleExport} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"><DownloadIcon className="w-5 h-5"/> خروجی اکسل</button></div>
                      {loading && <p>در حال بارگذاری...</p>}
                      {error && <p className="text-red-500">{error}</p>}
                      {!loading && !error && (
                          <div className="overflow-x-auto border rounded-lg">
                              <table className="min-w-full divide-y dark:divide-slate-700">
                                <thead className="bg-gray-100 dark:bg-slate-700"><tr>{['پرسنل', 'کد', 'تاریخ', 'ورود', 'خروج', 'تاخیر', 'تعجیل', 'عملیات'].map(h => <th key={h} className="p-3 text-right text-xs font-bold uppercase">{h}</th>)}</tr></thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y dark:divide-slate-700">
                                    {reportData.map(row => (
                                        <tr key={row.log_id}>
                                            <td className="p-3 text-sm font-semibold">{row.full_name}</td>
                                            <td className="p-3 text-sm">{toPersianDigits(row.personnel_code)}</td>
                                            <td className="p-3 text-sm">{toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td>
                                            <td className="p-3 text-sm">{formatTime(row.entry_time)}</td>
                                            <td className="p-3 text-sm">{formatTime(row.exit_time)}</td>
                                            <td className="p-3 text-sm text-orange-600">{calculateDifference(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late')}</td>
                                            <td className="p-3 text-sm text-yellow-600">{calculateDifference(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early')}</td>
                                            <td className="p-3 text-sm"><button onClick={() => handleOpenEditModal(row)} className="p-1 text-blue-600"><PencilIcon className="w-5 h-5"/></button><button onClick={() => handleDeleteLog(row.log_id)} className="p-1 text-red-600"><TrashIcon className="w-5 h-5"/></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                              </table>
                          </div>
                      )}
                  </div>
                )}
                
                {/* Present Report */}
                {activeTab === 'present' && (
                    <div className="space-y-4">
                        <div className="flex items-end gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <DatePicker date={presentDate} setDate={setPresentDate} label="انتخاب تاریخ"/>
                            <button onClick={fetchPresentReportData} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">نمایش</button>
                            <button onClick={handlePresentExport} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"><DownloadIcon className="w-5 h-5"/> خروجی اکسل</button>
                        </div>
                        {presentReportLoading && <p>در حال بارگذاری...</p>}
                        {presentReportError && <p className="text-red-500">{presentReportError}</p>}
                        {!presentReportLoading && !presentReportError && (
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y dark:divide-slate-700">
                                    <thead className="bg-gray-100 dark:bg-slate-700"><tr>{['نام کامل', 'کد پرسنلی', 'واحد', 'سمت', 'ساعت ورود', 'عملیات'].map(h => <th key={h} className="p-3 text-right text-xs font-bold uppercase">{h}</th>)}</tr></thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y dark:divide-slate-700">
                                        {presentReportData.map(row => (
                                            <tr key={row.log_id}>
                                                <td className="p-3 text-sm">{row.full_name}</td>
                                                <td className="p-3 text-sm">{toPersianDigits(row.personnel_code)}</td>
                                                <td className="p-3 text-sm">{row.department}</td>
                                                <td className="p-3 text-sm">{row.position}</td>
                                                <td className="p-3 text-sm">{formatTime(row.entry_time)}</td>
                                                <td className="p-3 text-sm"><button onClick={() => handleOpenEditModal(row)} className="p-1 text-blue-600"><PencilIcon className="w-5 h-5"/></button><button onClick={() => handleDeleteLog(row.log_id)} className="p-1 text-red-600"><TrashIcon className="w-5 h-5"/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Hourly Report */}
                {activeTab === 'hourly' && (
                    <div className="space-y-4">
                        <div className="flex justify-end"><button onClick={handleHourlyExport} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"><DownloadIcon className="w-5 h-5"/> خروجی اکسل</button></div>
                        {hourlyReportLoading && <p>در حال بارگذاری...</p>}
                        {hourlyReportError && <p className="text-red-500">{hourlyReportError}</p>}
                        {!hourlyReportLoading && !hourlyReportError && (
                             <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y dark:divide-slate-700">
                                    <thead className="bg-gray-100 dark:bg-slate-700"><tr>{['پرسنل', 'کد', 'تاریخ', 'خروج', 'ورود', 'مدت', 'شرح', 'ثبت کننده', 'عملیات'].map(h => <th key={h} className="p-3 text-right text-xs font-bold uppercase">{h}</th>)}</tr></thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y dark:divide-slate-700">
                                        {hourlyReportData.map(row => (
                                            <tr key={row.log_id}>
                                                <td className="p-3 text-sm font-semibold">{row.full_name}</td>
                                                <td className="p-3 text-sm">{toPersianDigits(row.personnel_code)}</td>
                                                <td className="p-3 text-sm">{toPersianDigits(new Date(row.exit_time || row.entry_time!).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td>
                                                <td className="p-3 text-sm">{formatTime(row.exit_time)}</td>
                                                <td className="p-3 text-sm">{formatTime(row.entry_time)}</td>
                                                <td className="p-3 text-sm">{calculateDuration(row.exit_time, row.entry_time)}</td>
                                                <td className="p-3 text-sm">{row.reason}</td>
                                                <td className="p-3 text-sm">{row.guard_name}</td>
                                                <td className="p-3 text-sm"><button onClick={() => handleOpenHourlyEditModal(row)} className="p-1 text-blue-600"><PencilIcon className="w-5 h-5"/></button><button onClick={() => handleDeleteHourlyLog(row.log_id)} className="p-1 text-red-600"><TrashIcon className="w-5 h-5"/></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Analysis Report */}
                {activeTab === 'analysis' && (
                    <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-2">
                           <h3 className="text-lg font-bold">تنظیمات محاسبه</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">ساعت استاندارد ورود</label>
                                    <div className="flex gap-2"><select value={standardTimes.entry.hour} onChange={e=>setStandardTimes(p=>({...p, entry: {...p.entry, hour: e.target.value}}))} className="p-2 border rounded-md w-full dark:bg-slate-800 dark:border-slate-600">{HOURS.map(h=><option key={h} value={h}>{toPersianDigits(h)}</option>)}</select><select value={standardTimes.entry.minute} onChange={e=>setStandardTimes(p=>({...p, entry: {...p.entry, minute: e.target.value}}))} className="p-2 border rounded-md w-full dark:bg-slate-800 dark:border-slate-600">{MINUTES.map(m=><option key={m} value={m}>{toPersianDigits(m)}</option>)}</select></div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">ساعت استاندارد خروج</label>
                                    <div className="flex gap-2"><select value={standardTimes.exit.hour} onChange={e=>setStandardTimes(p=>({...p, exit: {...p.exit, hour: e.target.value}}))} className="p-2 border rounded-md w-full dark:bg-slate-800 dark:border-slate-600">{HOURS.map(h=><option key={h} value={h}>{toPersianDigits(h)}</option>)}</select><select value={standardTimes.exit.minute} onChange={e=>setStandardTimes(p=>({...p, exit: {...p.exit, minute: e.target.value}}))} className="p-2 border rounded-md w-full dark:bg-slate-800 dark:border-slate-600">{MINUTES.map(m=><option key={m} value={m}>{toPersianDigits(m)}</option>)}</select></div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             <div className="p-4 bg-orange-100 dark:bg-orange-900/50 rounded-lg"><h4 className="text-sm">جمع کل تاخیر</h4><p className="text-xl font-bold">{formatMinutesToHours(analysisSummary.totalLateMinutes)}</p></div>
                             <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg"><h4 className="text-sm">جمع کل تعجیل</h4><p className="text-xl font-bold">{formatMinutesToHours(analysisSummary.totalEarlyMinutes)}</p></div>
                             <div className="p-4 bg-orange-100 dark:bg-orange-900/50 rounded-lg"><h4 className="text-sm">تعداد روزهای تاخیر</h4><p className="text-xl font-bold">{toPersianDigits(analysisSummary.lateCount)}</p></div>
                             <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg"><h4 className="text-sm">تعداد روزهای تعجیل</h4><p className="text-xl font-bold">{toPersianDigits(analysisSummary.earlyCount)}</p></div>
                        </div>
                        <div className="flex justify-end"><button onClick={handleAnalysisExport} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2"><DownloadIcon className="w-5 h-5"/> خروجی اکسل</button></div>
                    </div>
                )}

                {/* Monthly Report */}
                {activeTab === 'monthly' && (
                    <div className="text-center p-8 space-y-4">
                        <h3 className="text-lg font-bold">گزارش جامع ماهانه</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">یک فایل اکسل شامل خلاصه ماهانه، گزارش روزانه و گزارش ساعتی برای دوره زمانی انتخاب شده در فیلترها ایجاد کنید.</p>
                        <button onClick={handleMonthlyExport} className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700">ایجاد و دانلود گزارش ماهانه</button>
                        {monthlyExportStatus && <p className={`mt-4 p-2 rounded-md text-sm ${monthlyExportStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{monthlyExportStatus.message}</p>}
                    </div>
                )}
                
                {/* Edits Report */}
                {activeTab === 'edits' && (
                    <div className="space-y-4">
                        {editLogsLoading && <p>در حال بارگذاری...</p>}
                        {editLogsError && <p className="text-red-500">{editLogsError}</p>}
                        {!editLogsLoading && !editLogsError && (
                             <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y dark:divide-slate-700">
                                    <thead className="bg-gray-100 dark:bg-slate-700"><tr>{['تاریخ رکورد', 'پرسنل', 'ویرایشگر', 'زمان ویرایش', 'فیلد', 'مقدار قدیم', 'مقدار جدید'].map(h => <th key={h} className="p-3 text-right text-xs font-bold uppercase">{h}</th>)}</tr></thead>
                                    <tbody className="bg-white dark:bg-slate-800 divide-y dark:divide-slate-700">
                                        {editLogs.map(log => (
                                            <tr key={log.id}>
                                                <td className="p-3 text-sm">{toPersianDigits(new Date(log.record_date).toLocaleDateString('fa-IR', {timeZone: 'Asia/Tehran'}))}</td>
                                                <td className="p-3 text-sm font-semibold">{log.full_name}</td>
                                                <td className="p-3 text-sm">{log.editor_name}</td>
                                                <td className="p-3 text-sm">{toPersianDigits(new Date(log.edit_timestamp).toLocaleString('fa-IR', {timeZone: 'Asia/Tehran'}))}</td>
                                                <td className="p-3 text-sm">{log.field_name}</td>
                                                <td className="p-3 text-sm">{toPersianDigits(log.old_value)}</td>
                                                <td className="p-3 text-sm">{toPersianDigits(log.new_value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Backup Tab */}
                 {activeTab === 'backup' && (
                    <div className="space-y-6">
                        {backupStatus && <p className={`p-2 rounded-md text-sm ${backupStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{backupStatus.message}</p>}
                        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <h4 className="font-bold mb-2">پشتیبان‌گیری از تردد روزانه</h4>
                            <input type="file" ref={dailyBackupRef} onChange={handleBackupImport('daily')} className="hidden" id="daily-backup-import" />
                            <label htmlFor="daily-backup-import" className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer">ورود از اکسل</label>
                        </div>
                        <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <h4 className="font-bold mb-2">پشتیبان‌گیری از تردد ساعتی</h4>
                            <input type="file" ref={hourlyBackupRef} onChange={handleBackupImport('hourly')} className="hidden" id="hourly-backup-import" />
                            <label htmlFor="hourly-backup-import" className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer">ورود از اکسل</label>
                        </div>
                    </div>
                )}
          </div>

           {isEditModalOpen && editingLog && (
            <EditCommuteLogModal log={editingLog} onClose={handleCloseModals} onSave={handleSaveLog} />
          )}
          {isHourlyEditModalOpen && editingHourlyLog && (
            <EditHourlyLogModal log={editingHourlyLog} onClose={handleCloseModals} onSave={handleSaveHourlyLog} />
          )}
      </div>
    );
};

export default CommuteReportPage;