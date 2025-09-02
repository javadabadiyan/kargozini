import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteReportRow } from '../../types';

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

    const filterOptions = useMemo(() => {
        const departments = [...new Set(commutingMembers.map(m => m.department).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fa'));
        const positions = [...new Set(commutingMembers.map(m => m.position).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fa'));
        return { departments, positions };
    }, [commutingMembers]);

    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const response = await fetch('/api/commuting-members');
                if (!response.ok) throw new Error('Failed to fetch commuting members for filters');
                const data = await response.json();
                setCommutingMembers(data.members || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchFilterData();
    }, []);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        // FIX: Parse string date parts to integers before calling jalaliToGregorian.
        const gregFrom = jalaliToGregorian(parseInt(fromDate.year, 10), parseInt(fromDate.month, 10), parseInt(fromDate.day, 10));
        const gregTo = jalaliToGregorian(parseInt(toDate.year, 10), parseInt(toDate.month, 10), parseInt(toDate.day, 10));
        
        if (gregFrom) params.append('startDate', gregFrom);
        if (gregTo) params.append('endDate', gregTo);
        if (filters.personnelCode) params.append('personnelCode', filters.personnelCode);
        if (filters.department) params.append('department', filters.department);
        if (filters.position) params.append('position', filters.position);
        
        try {
            const response = await fetch(`/api/commute-reports?${params.toString()}`);
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
    }, [fromDate, toDate, filters]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const calculateDifference = useCallback((isoString: string | null, standardHour: string, standardMinute: string, type: 'late' | 'early'): string | null => {
        if (!isoString) return null;
        const logTime = new Date(isoString);
        
        const standardTime = new Date(logTime);
        standardTime.setHours(parseInt(standardHour), parseInt(standardMinute), 0, 0);

        let diffMinutes: number;
        if (type === 'late') {
            diffMinutes = (logTime.getTime() - standardTime.getTime()) / 60000;
            if (diffMinutes <= 0) return null; // Not late
        } else { // early exit
            diffMinutes = (standardTime.getTime() - logTime.getTime()) / 60000;
            if (diffMinutes <= 0) return null; // Not early
        }

        const hours = Math.floor(diffMinutes / 60);
        const minutes = Math.round(diffMinutes % 60);

        let result = [];
        if (hours > 0) result.push(`${toPersianDigits(hours)} ساعت`);
        if (minutes > 0) result.push(`${toPersianDigits(minutes)} دقیقه`);
        return result.join(' و ');
    }, []);

    const handleExport = () => {
        const dataToExport = reportData.map(row => ({
            'نام پرسنل': row.full_name,
            'کد': toPersianDigits(row.personnel_code),
            'واحد': row.department || '',
            'تاریخ': toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' })),
            'ورود': toPersianDigits(new Date(row.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })),
            'خروج': row.exit_time ? toPersianDigits(new Date(row.exit_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })) : '',
            'شیفت کاری': row.guard_name,
            'تاخیر': calculateDifference(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late') || '',
            'تعجیل': calculateDifference(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early') || '',
            'ماموریت': '۰',
            'مرخصی': '۰'
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش تردد');
        XLSX.writeFile(workbook, 'Commute_Report.xlsx');
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">گزارش گیری</h1>
                <p className="text-sm text-gray-500 mt-1">تحلیل و بررسی داده‌های تردد ثبت شده در سیستم</p>
            </div>

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
                            <tr>
                                {['نام پرسنل', 'کد', 'واحد', 'تاریخ', 'ورود', 'خروج', 'شیفت کاری', 'تاخیر', 'تعجیل', 'ماموریت', 'مرخصی'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? <tr><td colSpan={11} className="text-center p-4">در حال بارگذاری گزارش...</td></tr> :
                             error ? <tr><td colSpan={11} className="text-center p-4 text-red-500">{error}</td></tr> :
                             reportData.length === 0 ? <tr><td colSpan={11} className="text-center p-4 text-gray-500">هیچ داده‌ای مطابق با فیلترهای شما یافت نشد.</td></tr> :
                             reportData.map(row => {
                                 const late = calculateDifference(row.entry_time, standardTimes.entry.hour, standardTimes.entry.minute, 'late');
                                 const early = calculateDifference(row.exit_time, standardTimes.exit.hour, standardTimes.exit.minute, 'early');
                                 return (
                                    <tr key={row.log_id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{row.full_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(row.personnel_code)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{row.department}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(row.entry_time).toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(row.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }))}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{row.exit_time ? toPersianDigits(new Date(row.exit_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' })) : '---'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{row.guard_name}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${late ? 'text-red-600' : ''}`}>{late || '۰'}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${early ? 'text-red-600' : ''}`}>{early || '۰'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">۰</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">۰</td>
                                    </tr>
                                )
                             })}
                        </tbody>
                    </table>
                </div>
                 <div className="flex justify-end">
                    <button onClick={handleExport} disabled={reportData.length === 0} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">
                        خروجی اکسل
                    </button>
                </div>
            </div>
            )}
            {activeTab !== 'general' && <div className="text-center p-10 text-gray-500">این بخش از گزارش‌گیری در حال ساخت است.</div>}

            <style>{`
                .form-select { appearance: none; background-image: url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="%236b7280" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/></svg>'); background-position: left 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em; padding-left: 2.5rem; }
                .form-select, .form-select-sm { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: #fff; font-family: inherit; }
                .form-select-sm { font-size: 0.875rem; padding: 0.25rem 0.5rem; }
            `}</style>
        </div>
    );
};

export default CommuteReportPage;
