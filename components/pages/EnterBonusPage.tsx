import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { BonusData } from '../../types';
import { DownloadIcon, UploadIcon, DocumentReportIcon } from '../icons/Icons';

declare const XLSX: any;

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 7 }, (_, i) => 1404 + i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const EnterBonusPage: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState<number>(YEARS[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(PERSIAN_MONTHS[0]);
    const [bonusData, setBonusData] = useState<BonusData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchBonuses = useCallback(async (year: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=bonuses&year=${year}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت اطلاعات کارانه');
            }
            const data = await response.json();
            setBonusData(data.bonuses || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBonuses(selectedYear);
    }, [selectedYear, fetchBonuses]);

    const handleDownloadSample = () => {
        if (!selectedMonth) {
            setStatus({ type: 'error', message: 'لطفاً ابتدا یک ماه را برای تهیه فایل نمونه انتخاب کنید.' });
            return;
        }
        const headers = ['کد پرسنلی', `کارانه ${selectedMonth}`];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه کارانه');
        XLSX.writeFile(wb, `Sample_Bonus_${selectedMonth}.xlsx`);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!selectedMonth || !selectedYear) {
            setStatus({ type: 'error', message: 'لطفاً قبل از ورود اطلاعات، ماه و سال را مشخص کنید.' });
            return;
        }

        setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const bonusColumnName = `کارانه ${selectedMonth}`;

                const dataToUpload = json.map(row => ({
                    personnel_code: String(row['کد پرسنلی'] || ''),
                    bonus_value: row[bonusColumnName],
                })).filter(item => item.personnel_code && item.bonus_value !== undefined);
                
                if(dataToUpload.length === 0) {
                    throw new Error(`هیچ رکورد معتبری در فایل یافت نشد. لطفاً مطمئن شوید ستون‌های 'کد پرسنلی' و '${bonusColumnName}' وجود دارند.`);
                }

                const response = await fetch('/api/personnel?type=bonuses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        year: selectedYear,
                        month: selectedMonth,
                        data: dataToUpload,
                    }),
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                
                setStatus({ type: 'success', message: result.message });
                fetchBonuses(selectedYear); // Refresh data

            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل' });
            } finally {
                if(fileInputRef.current) fileInputRef.current.value = "";
                setTimeout(() => setStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExport = () => {
        const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'واحد', ...PERSIAN_MONTHS];
        const dataToExport = bonusData.map(person => {
            const row: any = {
                'کد پرسنلی': person.personnel_code,
                'نام و نام خانوادگی': `${person.first_name} ${person.last_name}`,
                'پست': person.position || '',
                'واحد': person.department || '',
            };
            PERSIAN_MONTHS.forEach(month => {
                row[month] = person.bonuses?.[month] ?? '';
            });
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `کارانه سال ${selectedYear}`);
        XLSX.writeFile(workbook, `Bonus_Report_${selectedYear}.xlsx`);
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">ثبت و مدیریت کارانه</h2>
                 <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200">
                        <DownloadIcon className="w-4 h-4" /> دانلود نمونه
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-bonus" accept=".xlsx, .xls" />
                    <label htmlFor="excel-import-bonus" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                        <UploadIcon className="w-4 h-4" /> ورود از اکسل
                    </label>
                    <button onClick={handleExport} disabled={bonusData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        <DownloadIcon className="w-4 h-4" /> خروجی اکسل
                    </button>
                </div>
            </div>

            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                <div>
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">انتخاب سال برای نمایش و ورود اطلاعات:</label>
                    <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md">
                        {YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">انتخاب ماه برای فایل نمونه/ورود اطلاعات:</label>
                    <select id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md">
                        {PERSIAN_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>
                            {['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'واحد', ...PERSIAN_MONTHS].map(header => (
                                <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading && <tr><td colSpan={16} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {error && <tr><td colSpan={16} className="text-center p-4 text-red-500">{error}</td></tr>}
                        {!loading && !error && bonusData.length === 0 && (
                            <tr><td colSpan={16} className="text-center p-8 text-gray-500"><DocumentReportIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />هیچ داده‌ای برای سال انتخاب شده یافت نشد.</td></tr>
                        )}
                        {!loading && !error && bonusData.map((person) => (
                            <tr key={person.personnel_code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(person.personnel_code)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">{person.first_name} {person.last_name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{person.position || '---'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{person.department || '---'}</td>
                                {PERSIAN_MONTHS.map(month => (
                                    <td key={month} className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                        {toPersianDigits(person.bonuses?.[month]) || '-'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default EnterBonusPage;
