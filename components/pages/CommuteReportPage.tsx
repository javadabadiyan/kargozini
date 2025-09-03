import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteReportRow, PresentMember, HourlyCommuteReportRow, CommuteEditLog, CommuteLog } from '../../types';
import { PencilIcon, TrashIcon, DownloadIcon, UploadIcon } from '../icons/Icons';
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
    if (!jy || !jm || !jd) return null;
    let sal_a, gy, gm, gd, j_day_no;
    sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    gy = jy + 621;
    let leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
    if (leap) sal_a[2] = 29;
    if (jm <= 6) j_day_no = (jm - 1) * 31 + jd;
    else j_day_no = 186 + (jm - 7) * 30 + jd;
    if (leap && j_day_no > 59) j_day_no++;
    if (j_day_no > 79) j_day_no -= 79;
    else { gy--; j_day_no += 286; leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0); if (leap) j_day_no++; }
    for (gm = 1; gm < 13; gm++) { if (j_day_no <= sal_a[gm]) break; j_day_no -= sal_a[gm]; }
    gd = j_day_no;
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
};

const DatePicker: React.FC<{ date: any, setDate: (date: any) => void }> = ({ date, setDate }) => {
    const setToday = () => {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = formatter.formatToParts(today);
        setDate({
            year: parseInt(parts.find(p => p.type === 'year')?.value || '0'),
            month: parseInt(parts.find(p => p.type === 'month')?.value || '0'),
            day: parseInt(parts.find(p => p.type === 'day')?.value || '0'),
        });
    };
    const clearDate = () => setDate({ year: '', month: '', day: '' });

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <select value={date.day} onChange={e => setDate({...date, day: e.target.value})} className="form-select"><option value="">روز</option>{DAYS.map(d=><option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                <select value={date.month} onChange={e => setDate({...date, month: e.target.value})} className="form-select"><option value="">ماه</option>{PERSIAN_MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>
                <select value={date.year} onChange={e => setDate({...date, year: e.target.value})} className="form-select"><option value="">سال</option>{YEARS.map(y=><option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
            </div>
            <div className="flex items-center gap-2 text-xs">
                <button onClick={setToday} className="text-blue-600 hover:underline">امروز</button>
                <button onClick={clearDate} className="text-gray-600 hover:underline">پاک کردن</button>
            </div>
        </div>
    );
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
        const departments = [...new Set(commutingMembers.map(m => m.department).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fa'));
        const positions = [...new Set(commutingMembers.map(m => m.position).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fa'));
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
            XLSX.utils.book_append_sheet(workbook, hourlyLogWorksheet, 'گزارش بین ساعتی');
    
            // 4. Analysis Sheet
            const analysisData = generalReports.map(row => ({ 'نام پرسنل': row.full_name, 'کد پرسنلی': toPersianDigits(row.personnel_code), 'تاریخ': toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })), 'میزان تاخیر (دقیقه)': toPersianDigits(calculateDifferenceInMinutes(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late')), 'میزان تعجیل (دقیقه)': toPersianDigits(calculateDifferenceInMinutes(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early')) }));
            const analysisWorksheet = XLSX.utils.json_to_sheet(analysisData);
            XLSX.utils.book_append_sheet(workbook, analysisWorksheet, 'تحلیل تاخیر-تعجیل');

            XLSX.writeFile(workbook, `Monthly_Report_${fromDate.year}-${fromDate.month}.xlsx`);
            setMonthlyExportStatus({ type: 'success', message: 'فایل اکسل جامع ماهانه با موفقیت ایجاد شد.' });
    
        } catch (err) {
            setMonthlyExportStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ایجاد فایل اکسل.' });
        } finally {
            setTimeout(() => setMonthlyExportStatus(null), 5000);
        }
    };
    
    const handleEditsExport = () => {
        const dataToExport = editLogs.map(log => ({
            'پرسنل': log.full_name,
            'تاریخ رکورد': toPersianDigits(new Date(log.record_date).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })),
            'کاربر ویرایشگر': log.editor_name,
            'زمان ویرایش': toPersianDigits(new Date(log.edit_timestamp).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })),
            'فیلد': log.field_name,
            'مقدار قبلی': toPersianDigits(log.old_value),
            'مقدار جدید': toPersianDigits(log.new_value)
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش ویرایش‌ها');
        XLSX.writeFile(workbook, 'Edits_Report.xlsx');
    };

    const analysisFilteredPersonnel = useMemo(() => {
        if (!analysisSearchTerm) return [];
        const lowercasedTerm = analysisSearchTerm.toLowerCase().trim();
        return commutingMembers.filter(m => 
            m.full_name.toLowerCase().includes(lowercasedTerm) || 
            m.personnel_code.includes(lowercasedTerm)
        ).slice(0, 5);
    }, [analysisSearchTerm, commutingMembers]);

    const analysisChartData = useMemo(() => {
        if (!selectedAnalysisPersonnel) return [];
        return reportData
            .filter(row => row.personnel_code === selectedAnalysisPersonnel.personnel_code)
            .map(row => ({
                date: new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }),
                lateness: calculateDifferenceInMinutes(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late'),
                earliness: calculateDifferenceInMinutes(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early'),
            }))
            .sort((a, b) => a.date.localeCompare(b.date, 'fa'));
    }, [selectedAnalysisPersonnel, reportData, standardTimes, calculateDifferenceInMinutes]);
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    // --- Backup and Restore Handlers ---

    const handleBackup = async (type: 'daily' | 'hourly') => {
        setBackupStatus({ type: 'info', message: 'در حال آماده سازی فایل پشتیبان...'});
        try {
            const reportType = type === 'daily' ? 'general' : 'hourly';
            const response = await fetch(`/api/commute-logs?report=${reportType}`);
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در دریافت داده‌ها');
            const data = await response.json();
            const rows = data.reports || [];
            
            let headers, dataToExport, fileName;

            if (type === 'daily') {
                headers = ['personnel_code', 'guard_name', 'entry_time', 'exit_time'];
                dataToExport = rows.map((r: CommuteReportRow) => ({
                    personnel_code: r.personnel_code,
                    guard_name: r.guard_name,
                    entry_time: r.entry_time,
                    exit_time: r.exit_time
                }));
                fileName = 'Daily_Commute_Backup.xlsx';
            } else {
                headers = ['personnel_code', 'full_name', 'guard_name', 'exit_time', 'entry_time', 'reason'];
                 dataToExport = rows.map((r: HourlyCommuteReportRow) => ({
                    personnel_code: r.personnel_code,
                    full_name: r.full_name,
                    guard_name: r.guard_name,
                    exit_time: r.exit_time,
                    entry_time: r.entry_time,
                    reason: r.reason,
                }));
                fileName = 'Hourly_Commute_Backup.xlsx';
            }

            const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Backup');
            XLSX.writeFile(workbook, fileName);

            setBackupStatus({ type: 'success', message: 'فایل پشتیبان با موفقیت دانلود شد.' });

        } catch (err) {
            setBackupStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ایجاد پشتیبان'});
        } finally {
            setTimeout(() => setBackupStatus(null), 5000);
        }
    };
    
    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>, type: 'daily' | 'hourly') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBackupStatus({ type: 'info', message: 'در حال پردازش فایل برای بازیابی...'});
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                const url = type === 'daily' ? '/api/commute-logs' : '/api/commute-logs?entity=hourly';
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(json)
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.details || data.error);

                setBackupStatus({ type: 'success', message: 'اطلاعات با موفقیت بازیابی شد.'});
                if (type === 'daily') fetchReportData();
                else fetchHourlyReportData();

            } catch (err) {
                setBackupStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در بازیابی اطلاعات'});
            } finally {
                if (e.target) e.target.value = "";
                setTimeout(() => setBackupStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">گزارش گیری</h1>
                <p className="text-sm text-gray-500 mt-1">تحلیل و بررسی داده‌های تردد ثبت شده در سیستم</p>
            </div>
            {backupStatus && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[backupStatus.type]}`}>{backupStatus.message}</div>}

            <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                <h2 className="font-bold text-gray-700">فیلتر گزارش</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1"><label className="text-sm font-medium">پرسنل</label><select value={filters.personnelCode} onChange={e => setFilters({...filters, personnelCode: e.target.value})} className="form-select"><option value="">همه پرسنل</option>{commutingMembers.map(m => <option key={m.personnel_code} value={m.personnel_code}>{m.full_name}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-sm font-medium">واحد</label><select value={filters.department} onChange={e => setFilters({...filters, department: e.target.value})} className="form-select"><option value="">همه واحدها</option>{filterOptions.departments.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-sm font-medium">سمت</label><select value={filters.position} onChange={e => setFilters({...filters, position: e.target.value})} className="form-select"><option value="">همه سمت‌ها</option>{filterOptions.positions.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-sm font-medium">از تاریخ</label><DatePicker date={fromDate} setDate={setFromDate} /></div>
                    <div className="space-y-1"><label className="text-sm font-medium">تا تاریخ</label><DatePicker date={toDate} setDate={setToDate} /></div>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-4 space-x-reverse" aria-label="Tabs">
                    {[{id: 'general', label: 'گزارش کلی'}, {id: 'present', label: 'گزارش حاضرین'}, {id: 'hourly', label: 'بین ساعتی'}, {id: 'analysis', label: 'تحلیل تاخیر/تعجیل'}, {id: 'monthly', label: 'گزارش ماهانه'}, {id: 'edits', label: 'گزارش ویرایش‌ها'}].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'general' && (
            <div className="space-y-4">
                 <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                    <h3 className="font-bold text-gray-700">پشتیبان‌گیری و بازیابی (تردد روزانه)</h3>
                    <p className="text-xs text-gray-500">از کل اطلاعات ترددهای روزانه یک فایل پشتیبان تهیه کنید یا اطلاعات را از یک فایل بازیابی نمایید. (فیلترهای بالا در این عملیات نادیده گرفته می‌شوند)</p>
                     <div className="flex items-center gap-2">
                        <button onClick={() => handleBackup('daily')} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                           <DownloadIcon className="w-5 h-5"/> تهیه پشتیبان
                        </button>
                        <input type="file" ref={dailyBackupRef} onChange={(e) => handleRestore(e, 'daily')} accept=".xlsx, .xls" className="hidden" id="daily-backup-import"/>
                        <label htmlFor="daily-backup-import" className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 cursor-pointer">
                           <UploadIcon className="w-5 h-5"/> بازیابی از فایل
                        </label>
                    </div>
                </div>
                <div className="p-4 border rounded-lg bg-slate-50 flex items-center gap-6">
                    <h3 className="font-bold text-gray-700">تنظیمات محاسبه تاخیر/تعجیل</h3>
                    <div className="flex items-center gap-2">
                        <label className="text-sm">ساعت موظفی ورود مبنا:</label>
                        <select value={standardTimes.entry.hour} onChange={e => setStandardTimes(s=>({...s, entry: {...s.entry, hour: e.target.value}}))} className="form-select-sm"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                        <select value={standardTimes.entry.minute} onChange={e => setStandardTimes(s=>({...s, entry: {...s.entry, minute: e.target.value}}))} className="form-select-sm"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                    </div>
                     <div className="flex items-center gap-2">
                        <label className="text-sm">ساعت موظفی خروج مبنا:</label>
                        <select value={standardTimes.exit.hour} onChange={e => setStandardTimes(s=>({...s, exit: {...s.exit, hour: e.target.value}}))} className="form-select-sm"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                        <select value={standardTimes.exit.minute} onChange={e => setStandardTimes(s=>({...s, exit: {...s.exit, minute: e.target.value}}))} className="form-select-sm"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                    </div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>{['نام پرسنل', 'کد', 'واحد', 'تاریخ', 'ورود', 'خروج', 'شیفت کاری', 'تاخیر', 'تعجیل', 'ماموریت', 'مرخصی', 'عملیات'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? <tr><td colSpan={12} className="text-center p-4">در حال بارگذاری گزارش...</td></tr> : error ? <tr><td colSpan={12} className="text-center p-4 text-red-500">{error}</td></tr> : reportData.length === 0 ? <tr><td colSpan={12} className="text-center p-4 text-gray-500">هیچ داده‌ای مطابق با فیلترهای شما یافت نشد.</td></tr> : reportData.map(row => { const late = calculateDifference(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late'); const early = calculateDifference(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early'); return (<tr key={row.log_id} className="hover:bg-slate-50"><td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{row.full_name}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(row.personnel_code)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.department}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(row.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }))}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.exit_time ? toPersianDigits(new Date(row.exit_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })) : '---'}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.guard_name}</td><td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${late ? 'text-red-600' : ''}`}>{late || '۰'}</td><td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${early ? 'text-red-600' : ''}`}>{early || '۰'}</td><td className="px-4 py-3 whitespace-nowrap text-sm">۰</td><td className="px-4 py-3 whitespace-nowrap text-sm">۰</td><td className="px-4 py-3 whitespace-nowrap text-sm"><div className="flex items-center justify-center gap-1"><button onClick={() => handleOpenEditModal(row)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full" title="ویرایش"><PencilIcon className="w-5 h-5" /></button><button onClick={() => handleDeleteLog(row.log_id)} className="p-1 text-red-600 hover:bg-red-100 rounded-full" title="حذف"><TrashIcon className="w-5 h-5" /></button></div></td></tr>)})}
                        </tbody>
                    </table>
                </div>
                 <div className="flex justify-end"><button onClick={handleExport} disabled={reportData.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">خروجی اکسل</button></div>
            </div>
            )}

            {activeTab === 'present' && (
            <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-slate-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-700">انتخاب تاریخ گزارش حاضرین</h3>
                    <div className="w-72"><DatePicker date={presentDate} setDate={setPresentDate} /></div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>{['نام کامل', 'کد پرسنلی', 'واحد', 'سمت', 'ساعت ورود', 'عملیات'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {presentReportLoading ? <tr><td colSpan={6} className="text-center p-4">در حال بارگذاری گزارش...</td></tr> : presentReportError ? <tr><td colSpan={6} className="text-center p-4 text-red-500">{presentReportError}</td></tr> : presentReportData.length === 0 ? <tr><td colSpan={6} className="text-center p-4 text-gray-500">هیچ فردی در تاریخ انتخابی حاضر نمی‌باشد.</td></tr> : presentReportData.map(row => (<tr key={row.log_id} className="hover:bg-slate-50"><td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{row.full_name}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(row.personnel_code)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.department}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.position}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(row.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }))}</td><td className="px-4 py-3 whitespace-nowrap text-sm"><div className="flex items-center justify-center gap-1"><button onClick={() => handleOpenEditModal(row)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full" title="ویرایش"><PencilIcon className="w-5 h-5" /></button><button onClick={() => handleDeleteLog(row.log_id)} className="p-1 text-red-600 hover:bg-red-100 rounded-full" title="حذف"><TrashIcon className="w-5 h-5" /></button></div></td></tr>))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end"><button onClick={handlePresentExport} disabled={presentReportData.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">خروجی اکسل</button></div>
            </div>
            )}

            {activeTab === 'hourly' && (
            <div className="space-y-4">
                 <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                    <h3 className="font-bold text-gray-700">پشتیبان‌گیری و بازیابی (تردد بین ساعتی)</h3>
                    <p className="text-xs text-gray-500">از کل اطلاعات ترددهای بین ساعتی یک فایل پشتیبان تهیه کنید یا اطلاعات را از یک فایل بازیابی نمایید. (فیلترهای بالا در این عملیات نادیده گرفته می‌شوند)</p>
                     <div className="flex items-center gap-2">
                        <button onClick={() => handleBackup('hourly')} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                           <DownloadIcon className="w-5 h-5"/> تهیه پشتیبان
                        </button>
                        <input type="file" ref={hourlyBackupRef} onChange={(e) => handleRestore(e, 'hourly')} accept=".xlsx, .xls" className="hidden" id="hourly-backup-import"/>
                        <label htmlFor="hourly-backup-import" className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 cursor-pointer">
                           <UploadIcon className="w-5 h-5"/> بازیابی از فایل
                        </label>
                    </div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>{['نام پرسنل', 'کد', 'واحد', 'تاریخ', 'خروج', 'ورود', 'مدت', 'شرح', 'ثبت کننده', 'عملیات'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {hourlyReportLoading ? <tr><td colSpan={10} className="text-center p-4">در حال بارگذاری گزارش...</td></tr> : hourlyReportError ? <tr><td colSpan={10} className="text-center p-4 text-red-500">{hourlyReportError}</td></tr> : hourlyReportData.length === 0 ? <tr><td colSpan={10} className="text-center p-4 text-gray-500">هیچ تردد بین ساعتی مطابق با فیلترهای شما یافت نشد.</td></tr> : hourlyReportData.map(row => (<tr key={row.log_id} className="hover:bg-slate-50"><td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{row.full_name}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(row.personnel_code)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.department}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(row.exit_time || row.entry_time!).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{formatTime(row.exit_time)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{formatTime(row.entry_time)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{calculateDuration(row.exit_time, row.entry_time)}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.reason || '---'}</td><td className="px-4 py-3 whitespace-nowrap text-sm">{row.guard_name}</td><td className="px-4 py-3 whitespace-nowrap text-sm"><div className="flex items-center justify-center gap-1"><button onClick={() => handleOpenHourlyEditModal(row)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full" title="ویرایش"><PencilIcon className="w-5 h-5" /></button><button onClick={() => handleDeleteHourlyLog(row.log_id)} className="p-1 text-red-600 hover:bg-red-100 rounded-full" title="حذف"><TrashIcon className="w-5 h-5" /></button></div></td></tr>))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end"><button onClick={handleHourlyExport} disabled={hourlyReportData.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">خروجی اکسل</button></div>
            </div>
            )}
            
            {activeTab === 'analysis' && (
                <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
                         <h3 className="font-bold text-gray-700">تنظیمات تحلیل</h3>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <label className="text-sm">ساعت موظفی ورود:</label>
                                <select value={standardTimes.entry.hour} onChange={e => setStandardTimes(s=>({...s, entry: {...s.entry, hour: e.target.value}}))} className="form-select-sm"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                                <select value={standardTimes.entry.minute} onChange={e => setStandardTimes(s=>({...s, entry: {...s.entry, minute: e.target.value}}))} className="form-select-sm"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                            </div>
                             <div className="flex items-center gap-2">
                                <label className="text-sm">ساعت موظفی خروج:</label>
                                <select value={standardTimes.exit.hour} onChange={e => setStandardTimes(s=>({...s, exit: {...s.exit, hour: e.target.value}}))} className="form-select-sm"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                                <select value={standardTimes.exit.minute} onChange={e => setStandardTimes(s=>({...s, exit: {...s.exit, minute: e.target.value}}))} className="form-select-sm"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-2 relative">
                        <label htmlFor="analysis-search" className="font-bold text-gray-700">جستجوی پرسنل برای نمودار</label>
                        <input id="analysis-search" type="text" value={analysisSearchTerm} onChange={e => setAnalysisSearchTerm(e.target.value)} placeholder="نام، کد یا واحد..." className="form-select"/>
                        {analysisFilteredPersonnel.length > 0 && (
                            <div className="absolute top-full right-0 left-0 bg-white border border-gray-300 rounded-b-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                                {analysisFilteredPersonnel.map(p => (
                                    <button key={p.id} onClick={() => { setSelectedAnalysisPersonnel(p); setAnalysisSearchTerm(p.full_name); }} className="block w-full text-right px-4 py-2 hover:bg-gray-100">{p.full_name} ({toPersianDigits(p.personnel_code)})</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border rounded-lg min-h-[300px]">
                        {loading ? <div className="text-center p-4">در حال بارگذاری داده‌ها...</div> : !selectedAnalysisPersonnel ? (
                            <div className="flex items-center justify-center h-full text-center text-gray-500">
                                <p>برای مشاهده نمودار، لطفا یک پرسنل را از لیست بالا انتخاب و جستجو کنید.</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-lg font-bold mb-4">نمودار تحلیل برای: {selectedAnalysisPersonnel.full_name}</h3>
                                {analysisChartData.length === 0 ? <p>داده ترددی برای این پرسنل در بازه انتخابی یافت نشد.</p> : (
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {analysisChartData.map(data => (
                                    <div key={data.date} className="grid grid-cols-12 items-center gap-2 text-sm">
                                        <div className="col-span-2 font-semibold">{toPersianDigits(data.date)}</div>
                                        <div className="col-span-5 flex items-center">
                                            <span className="w-12">تاخیر:</span>
                                            <div className="w-full bg-gray-200 rounded-full h-4 relative">
                                                <div className="bg-red-500 h-4 rounded-full" style={{width: `${Math.min(100, (data.lateness/60)*100)}%`}}></div>
                                            </div>
                                            <span className="w-24 text-right pr-2">{data.lateness > 0 ? `${toPersianDigits(data.lateness)} دقیقه` : '۰'}</span>
                                        </div>
                                         <div className="col-span-5 flex items-center">
                                            <span className="w-12">تعجیل:</span>
                                            <div className="w-full bg-gray-200 rounded-full h-4">
                                                <div className="bg-orange-400 h-4 rounded-full" style={{width: `${Math.min(100, (data.earliness/60)*100)}%`}}></div>
                                            </div>
                                            <span className="w-24 text-right pr-2">{data.earliness > 0 ? `${toPersianDigits(data.earliness)} دقیقه` : '۰'}</span>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end"><button onClick={handleAnalysisExport} disabled={reportData.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">خروجی اکسل کل گزارش</button></div>
                </div>
            )}
            
            {activeTab === 'monthly' && (
                <div className="space-y-4">
                    {monthlyExportStatus && (
                        <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[monthlyExportStatus.type]}`} role="alert">
                          {monthlyExportStatus.message}
                        </div>
                    )}
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                        <h3 className="font-bold text-gray-700">راهنمای گزارش ماهانه:</h3>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            <li>برای ایجاد گزارش ماهانه، حتما فیلتر "از تاریخ" را با روزی از ماه مورد نظر خود تنظیم کنید.</li>
                            <li>این گزارش یک فایل اکسل جامع با شیت‌های مختلف (خلاصه، کارکرد، تردد بین ساعتی، و تحلیل) ایجاد می‌کند.</li>
                            <li>می‌توانید با استفاده از فیلترهای "پرسنل" و "واحد"، گزارش را برای افراد یا واحدهای خاصی محدود کنید.</li>
                        </ul>
                    </div>
                    <div className="flex justify-center pt-4">
                        <button 
                            onClick={handleMonthlyExport}
                            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors shadow-md"
                        >
                            خروجی اکسل جامع ماهانه
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'edits' && (
            <div className="space-y-4">
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {['پرسنل', 'تاریخ رکورد', 'کاربر ویرایشگر', 'زمان ویرایش', 'فیلد', 'مقدار قبلی', 'مقدار جدید'].map(h => 
                                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {editLogsLoading ? (
                                <tr><td colSpan={7} className="text-center p-4">در حال بارگذاری گزارش...</td></tr>
                            ) : editLogsError ? (
                                <tr><td colSpan={7} className="text-center p-4 text-red-500">{editLogsError}</td></tr>
                            ) : editLogs.length === 0 ? (
                                <tr><td colSpan={7} className="text-center p-4 text-gray-500">هیچ ویرایشی مطابق با فیلترهای شما یافت نشد.</td></tr>
                            ) : (
                                editLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{log.full_name} ({toPersianDigits(log.personnel_code)})</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(log.record_date).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{log.editor_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(log.edit_timestamp).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{log.field_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{toPersianDigits(log.old_value) || '---'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">{toPersianDigits(log.new_value) || '---'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end">
                    <button onClick={handleEditsExport} disabled={editLogs.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">
                        خروجی اکسل
                    </button>
                </div>
            </div>
            )}

            {isEditModalOpen && editingLog && (
                <EditCommuteLogModal log={editingLog} onClose={handleCloseModals} onSave={handleSaveLog} />
            )}
            {isHourlyEditModalOpen && editingHourlyLog && (
                <EditHourlyLogModal log={editingHourlyLog} onClose={handleCloseModals} onSave={handleSaveHourlyLog} />
            )}

            <style>{`.form-select { appearance: none; background-image: url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="%236b7280" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/></svg>'); background-position: left 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em; padding-left: 2.5rem; }.form-select, .form-select-sm { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: #fff; font-family: inherit; }.form-select-sm { font-size: 0.875rem; padding: 0.25rem 0.5rem; }`}</style>
        </div>
    );
};

export default CommuteReportPage;