
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteReportRow } from '../../types';
import { DocumentArrowDownIcon } from '../icons/Icons';

// Type alias for SheetJS
declare const XLSX: any;

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => 1403 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// --- Helper Functions ---
const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const jalaliToGregorianString = (jy: number, jm: number, jd: number): string => {
    let sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gy = jy + 621;
    let leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    if (leap) sal_a[2] = 29;
    let j_day_no = (jm <= 6) ? (jm - 1) * 31 + jd : 186 + (jm - 7) * 30 + jd;
    if (leap && j_day_no > 59) j_day_no++;
    if (j_day_no > 79) {
        j_day_no -= 79;
    } else {
        gy--;
        j_day_no += 286;
        leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
        if (leap) j_day_no++;
    }
    let gm = 1;
    for (; gm < 13; gm++) {
        if (j_day_no <= sal_a[gm]) break;
        j_day_no -= sal_a[gm];
    }
    const gd = j_day_no;
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
};

const formatDuration = (totalMinutes: number | undefined | null) => {
    if (totalMinutes === undefined || totalMinutes === null || totalMinutes <= 0) return '---';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);
    let result = '';
    if (hours > 0) result += `${toPersianDigits(hours)} ساعت`;
    if (minutes > 0) result += `${hours > 0 ? ' و ' : ''}${toPersianDigits(minutes)} دقیقه`;
    return result;
};

const getTodayPersian = () => {
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = formatter.formatToParts(new Date());
    return {
        year: parseInt(parts.find(p => p.type === 'year')?.value || '0'),
        month: parseInt(parts.find(p => p.type === 'month')?.value || '0'),
        day: parseInt(parts.find(p => p.type === 'day')?.value || '0'),
    };
};

// --- Main Component ---
const CommuteReportPage: React.FC = () => {
    const today = getTodayPersian();
    const [filters, setFilters] = useState({
        personnel: 'all',
        unit: 'all',
        fromDate: { year: today.year, month: today.month, day: today.day },
        toDate: { year: today.year, month: today.month, day: today.day },
    });
    const [settings, setSettings] = useState({
        standardEntry: { hour: 6, minute: 0 },
        standardExit: { hour: 14, minute: 0 },
    });
    const [activeTab, setActiveTab] = useState('analysis');
    
    const [personnelList, setPersonnelList] = useState<CommutingMember[]>([]);
    const [unitList, setUnitList] = useState<string[]>([]);
    const [reportData, setReportData] = useState<CommuteReportRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch data for filters
    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const response = await fetch('/api/commuting-members');
                const data = await response.json();
                const members: CommutingMember[] = data.members || [];
                setPersonnelList(members);
                const uniqueUnits = [...new Set(members.map(m => m.department).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fa'));
                setUnitList(uniqueUnits as string[]);
            } catch (err) {
                console.error("Failed to fetch commuting members for filters", err);
            }
        };
        fetchFilterData();
    }, []);

    // Fetch report data when filters change
    const fetchReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { fromDate, toDate, personnel, unit } = filters;
            const startDate = jalaliToGregorianString(fromDate.year, fromDate.month, fromDate.day);
            const endDate = jalaliToGregorianString(toDate.year, toDate.month, toDate.day);

            const params = new URLSearchParams({
                startDate,
                endDate,
                personnelCode: personnel,
                department: unit
            });

            const response = await fetch(`/api/commute-reports?${params.toString()}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'خطا در دریافت گزارش');
            }
            const data = await response.json();
            setReportData(data.reports || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.');
        } finally {
            setLoading(false);
        }
    }, [filters]);
    
    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const calculatedData = useMemo(() => {
        if (activeTab !== 'analysis') return reportData;
        
        return reportData.map(log => {
            const standardEntry = new Date(log.entry_time);
            standardEntry.setUTCHours(settings.standardEntry.hour, settings.standardEntry.minute, 0, 0);

            const standardExit = new Date(log.entry_time);
            standardExit.setUTCHours(settings.standardExit.hour, settings.standardExit.minute, 0, 0);

            const actualEntry = new Date(log.entry_time);
            const lateness_minutes = actualEntry > standardEntry ? (actualEntry.getTime() - standardEntry.getTime()) / 60000 : 0;
            
            let early_leave_minutes = 0;
            if (log.exit_time) {
                const actualExit = new Date(log.exit_time);
                if(actualExit < standardExit) {
                   early_leave_minutes = (standardExit.getTime() - actualExit.getTime()) / 60000;
                }
            }

            return { ...log, lateness_minutes, early_leave_minutes };
        });
    }, [reportData, activeTab, settings]);

    const handleExport = () => {
        const dataToExport = calculatedData.map(row => ({
            'نام پرسنل': row.full_name,
            'کد': row.personnel_code,
            'واحد': row.department,
            'تاریخ': new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }),
            'ورود': new Date(row.entry_time).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }),
            'خروج': row.exit_time ? new Date(row.exit_time).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }) : '---',
            'شیفت کاری': row.guard_name,
            'تاخیر': formatDuration(row.lateness_minutes),
            'تعجیل': formatDuration(row.early_leave_minutes),
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش تردد');
        XLSX.writeFile(workbook, 'Commute_Report.xlsx');
    };

    const DatePicker = ({ value, onChange, namePrefix }: { value: { year: number, month: number, day: number }, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, namePrefix: string }) => (
        <div className="grid grid-cols-3 gap-1">
            <select name={`${namePrefix}_day`} value={value.day} onChange={onChange} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans text-sm">{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
            <select name={`${namePrefix}_month`} value={value.month} onChange={onChange} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans text-sm">{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <select name={`${namePrefix}_year`} value={value.year} onChange={onChange} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans text-sm">{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
        </div>
    );

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name.startsWith('fromDate_')) {
            const key = name.split('_')[1];
            setFilters(f => ({ ...f, fromDate: { ...f.fromDate, [key]: parseInt(value) } }));
        } else if (name.startsWith('toDate_')) {
            const key = name.split('_')[1];
            setFilters(f => ({ ...f, toDate: { ...f.toDate, [key]: parseInt(value) } }));
        } else {
            setFilters(f => ({ ...f, [name]: value }));
        }
    };

    const handleSettingsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        const [group, key] = name.split('_'); // e.g., "standardEntry_hour"
        setSettings(s => ({...s, [group]: { ...s[group as keyof typeof s], [key]: parseInt(value) }}));
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h1 className="text-2xl font-bold text-gray-800">گزارش گیری</h1>
                <p className="mt-1 text-sm text-gray-500">تحلیل و بررسی داده‌های تردد ثبت شده در سیستم</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-lg space-y-4">
                <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">فیلتر گزارش</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1">پرسنل</label>
                        <select name="personnel" value={filters.personnel} onChange={handleFilterChange} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 text-sm">
                            <option value="all">همه پرسنل</option>
                            {personnelList.map(p => <option key={p.id} value={p.personnel_code}>{p.full_name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1">واحد</label>
                        <select name="unit" value={filters.unit} onChange={handleFilterChange} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 text-sm">
                            <option value="all">همه واحدها</option>
                             {unitList.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1">از تاریخ</label>
                        <DatePicker value={filters.fromDate} onChange={handleFilterChange} namePrefix="fromDate" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-600 block mb-1">تا تاریخ</label>
                        <DatePicker value={filters.toDate} onChange={handleFilterChange} namePrefix="toDate" />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Main content */}
                    <div className="flex-grow">
                        <div className="flex items-center justify-between border-b pb-3 mb-4">
                             <div className="flex items-center gap-2">
                                <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 text-sm rounded-md ${activeTab === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>تحلیل تاخیر/تعجیل</button>
                                <button disabled className="px-4 py-2 text-sm rounded-md bg-gray-200 text-gray-400 cursor-not-allowed">گزارش کلی</button>
                                <button disabled className="px-4 py-2 text-sm rounded-md bg-gray-200 text-gray-400 cursor-not-allowed">گزارش حاضرین</button>
                             </div>
                             <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                                <DocumentArrowDownIcon className="w-5 h-5" />
                                خروجی اکسل
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['نام پرسنل', 'کد', 'واحد', 'تاریخ', 'ورود', 'خروج', 'شیفت کاری', 'تاخیر', 'تعجیل'].map(h => 
                                            <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase whitespace-nowrap">{h}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loading && <tr><td colSpan={9} className="text-center p-4">در حال بارگذاری گزارش...</td></tr>}
                                    {error && <tr><td colSpan={9} className="text-center p-4 text-red-500">{error}</td></tr>}
                                    {!loading && !error && calculatedData.length === 0 && <tr><td colSpan={9} className="text-center p-4 text-gray-500">داده‌ای برای نمایش با فیلترهای انتخاب شده وجود ندارد.</td></tr>}
                                    {!loading && !error && calculatedData.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">{log.full_name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{toPersianDigits(log.personnel_code)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.department || '---'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-sans">{new Date(log.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-sans">{new Date(log.entry_time).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour:'2-digit', minute:'2-digit' })}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-sans">{log.exit_time ? new Date(log.exit_time).toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran', hour:'2-digit', minute:'2-digit' }) : '---'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.guard_name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-orange-600 font-semibold">{formatDuration(log.lateness_minutes)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDuration(log.early_leave_minutes)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    {/* Settings sidebar */}
                    <div className="lg:w-64 flex-shrink-0">
                         <div className="bg-slate-50 p-4 rounded-lg border">
                            <h3 className="text-md font-semibold text-gray-700 mb-3">تنظیمات محاسبه تاخیر/تعجیل</h3>
                             <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 block mb-1">ساعت موظفی ورود مبنا</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select name="standardEntry_hour" value={settings.standardEntry.hour} onChange={handleSettingsChange} className="w-full p-2 border border-gray-300 rounded-md bg-white font-sans text-sm">{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}</select>
                                        <select name="standardEntry_minute" value={settings.standardEntry.minute} onChange={handleSettingsChange} className="w-full p-2 border border-gray-300 rounded-md bg-white font-sans text-sm">{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}</select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 block mb-1">ساعت موظفی خروج مبنا</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select name="standardExit_hour" value={settings.standardExit.hour} onChange={handleSettingsChange} className="w-full p-2 border border-gray-300 rounded-md bg-white font-sans text-sm">{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}</select>
                                        <select name="standardExit_minute" value={settings.standardExit.minute} onChange={handleSettingsChange} className="w-full p-2 border border-gray-300 rounded-md bg-white font-sans text-sm">{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}</select>
                                    </div>
                                </div>
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommuteReportPage;
