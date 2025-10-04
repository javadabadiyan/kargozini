import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BonusData, Personnel } from '../../types';
import { DownloadIcon, UploadIcon, DocumentReportIcon, SearchIcon, UserPlusIcon } from '../icons/Icons';

declare const XLSX: any;

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 7 }, (_, i) => 1404 + i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    const str = String(s);
    if (typeof s === 'number' && !isNaN(s)) {
        return s.toLocaleString('fa-IR', { useGrouping: false });
    }
    return str.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const EnterBonusPage: React.FC = () => {
    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    const canView = useMemo(() => currentUser.permissions?.enter_bonus, [currentUser]);

    const [selectedYear, setSelectedYear] = useState<number>(YEARS[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(PERSIAN_MONTHS[0]);
    const [bonusData, setBonusData] = useState<BonusData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Manual entry states
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [showManualForm, setShowManualForm] = useState(false);
    const [personnelSearchTerm, setPersonnelSearchTerm] = useState('');
    const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
    const [manualBonusAmount, setManualBonusAmount] = useState('');
    const [manualDepartment, setManualDepartment] = useState('');

    const fetchBonuses = useCallback(async (year: number) => {
        if (!canView) {
            setLoading(false);
            return;
        }
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
    }, [canView]);

    useEffect(() => {
        const fetchAllPersonnel = async () => {
            if (!canView) {
                setPersonnelLoading(false);
                return;
            }
            setPersonnelLoading(true);
            try {
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('Failed to fetch personnel list');
                const data = await response.json();
                setPersonnelList(data.personnel || []);
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Could not load personnel list' });
            } finally {
                setPersonnelLoading(false);
            }
        };

        fetchAllPersonnel();
    }, [canView]);

    useEffect(() => {
        fetchBonuses(selectedYear);
    }, [selectedYear, fetchBonuses]);
    
    const getLatestDepartment = (monthlyData: BonusData['monthly_data']): string => {
        if (!monthlyData) return '---';
        for (const month of [...PERSIAN_MONTHS].reverse()) {
            if (monthlyData[month] && monthlyData[month].department) {
                return monthlyData[month].department;
            }
        }
        return '---';
    };

    useEffect(() => {
        if (selectedPersonnel) {
            const existingData = bonusData.find(b => b.personnel_code === selectedPersonnel.personnel_code);
            setManualDepartment(getLatestDepartment(existingData?.monthly_data) || selectedPersonnel.department || '');
            setManualBonusAmount('');
        }
    }, [selectedPersonnel, bonusData]);

    const filteredPersonnel = useMemo(() => {
        if (!personnelSearchTerm) return [];
        const lowercasedTerm = personnelSearchTerm.toLowerCase().trim();
        return personnelList.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
            p.personnel_code.toLowerCase().includes(lowercasedTerm)
        ).slice(0, 5);
    }, [personnelList, personnelSearchTerm]);

    const handleDownloadSample = () => {
        if (!selectedMonth) {
            setStatus({ type: 'error', message: 'لطفاً ابتدا یک ماه را برای تهیه فایل نمونه انتخاب کنید.' });
            return;
        }
        const headers = ['کد پرسنلی', 'نام', 'نام خانوادگی', 'پست', `واحد ${selectedMonth}`, `کارانه ${selectedMonth}`];
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
                
                const departmentColumnName = `واحد ${selectedMonth}`;
                const bonusColumnName = `کارانه ${selectedMonth}`;

                const dataToUpload = json.map(row => ({
                    personnel_code: String(row['کد پرسنلی'] || ''),
                    first_name: String(row['نام'] || ''),
                    last_name: String(row['نام خانوادگی'] || ''),
                    position: String(row['پست'] || ''),
                    department: String(row[departmentColumnName] || ''),
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
                if (!response.ok) throw new Error(result.details || result.error);
                
                setStatus({ type: 'success', message: result.message });
                fetchBonuses(selectedYear);

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
        const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'آخرین واحد', ...PERSIAN_MONTHS];
        const dataToExport = bonusData.map(person => {
            const row: any = {
                'کد پرسنلی': person.personnel_code,
                'نام و نام خانوادگی': `${person.first_name} ${person.last_name}`,
                'پست': person.position || '',
                'آخرین واحد': getLatestDepartment(person.monthly_data),
            };
            PERSIAN_MONTHS.forEach(month => {
                row[month] = person.monthly_data?.[month]?.bonus ?? '';
            });
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `کارانه سال ${selectedYear}`);
        XLSX.writeFile(workbook, `Bonus_Report_${selectedYear}.xlsx`);
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPersonnel || !manualBonusAmount || !manualDepartment) {
            setStatus({ type: 'error', message: 'لطفاً پرسنل، مبلغ کارانه و واحد را مشخص کنید.' });
            return;
        }

        setStatus({ type: 'info', message: `در حال ثبت کارانه برای ${selectedPersonnel.first_name} ${selectedPersonnel.last_name}...` });

        const dataToUpload = [{
            personnel_code: selectedPersonnel.personnel_code,
            first_name: selectedPersonnel.first_name,
            last_name: selectedPersonnel.last_name,
            position: selectedPersonnel.position,
            department: manualDepartment,
            bonus_value: Number(toEnglishDigits(manualBonusAmount).replace(/,/g, '')),
        }];

        try {
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
            if (!response.ok) throw new Error(result.details || result.error);
            
            setStatus({ type: 'success', message: result.message });
            fetchBonuses(selectedYear);
            // Reset part of the form
            setSelectedPersonnel(null);
            setPersonnelSearchTerm('');
            setManualBonusAmount('');
            setManualDepartment('');

        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت کارانه' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleBonusAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = toEnglishDigits(e.target.value).replace(/,/g, '');
        if (/^\d*$/.test(val)) {
            setManualBonusAmount(val);
        }
    };
    
    if (!canView) {
        return (
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl flex items-center justify-center h-full">
              <div className="text-center text-slate-600 dark:text-slate-400">
                <h2 className="text-2xl font-bold mb-4">عدم دسترسی</h2>
                <p>شما به این صفحه دسترسی ندارید. لطفاً با مدیر سیستم تماس بگیرید.</p>
              </div>
            </div>
        );
    }

    const statusColor = { info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">ثبت و مدیریت کارانه</h2>
                 <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowManualForm(prev => !prev)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <UserPlusIcon className="w-4 h-4" /> {showManualForm ? 'بستن فرم' : 'افزودن دستی کارانه'}
                    </button>
                    <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500 dark:hover:bg-slate-500">
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

            {showManualForm && (
                <div className="p-4 my-4 border rounded-lg bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 transition-all duration-300">
                    <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-4">ثبت دستی کارانه برای ماه {selectedMonth} سال {toPersianDigits(selectedYear)}</h3>
                    {!selectedPersonnel ? (
                        <div>
                            <label htmlFor="personnel-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">۱. جستجوی پرسنل</label>
                            <div className="relative">
                                <input type="text" id="personnel-search" value={personnelSearchTerm} onChange={e => setPersonnelSearchTerm(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md" placeholder="نام یا کد پرسنلی را وارد کنید..."/>
                                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                            {personnelLoading && <p className="text-sm mt-2">در حال بارگذاری پرسنل...</p>}
                            {personnelSearchTerm && filteredPersonnel.length > 0 && (
                                <ul className="mt-2 border rounded-md bg-white dark:bg-slate-600 max-h-48 overflow-y-auto z-10">
                                    {filteredPersonnel.map(p => (
                                        <li key={p.id} onClick={() => { setSelectedPersonnel(p); setPersonnelSearchTerm(''); }} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-500 cursor-pointer text-sm">
                                            {p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleManualSubmit}>
                            <div className="flex justify-between items-center mb-4 p-2 bg-white dark:bg-slate-600 rounded-md">
                                <div>
                                    <p className="text-sm font-semibold">{selectedPersonnel.first_name} {selectedPersonnel.last_name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-300">کد: {toPersianDigits(selectedPersonnel.personnel_code)}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedPersonnel(null)} className="text-xs text-red-600 dark:text-red-400 hover:underline">تغییر پرسنل</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="manual-bonus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مبلغ کارانه (ریال)</label>
                                    <input id="manual-bonus" type="text" value={toPersianDigits(formatCurrency(manualBonusAmount))} onChange={handleBonusAmountChange} className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md font-sans text-left" required />
                                </div>
                                <div>
                                    <label htmlFor="manual-department" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">واحد</label>
                                    <input id="manual-department" type="text" value={manualDepartment} onChange={e => setManualDepartment(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md" required />
                                </div>
                            </div>
                            <div className="flex justify-end mt-4">
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">ثبت کارانه</button>
                            </div>
                        </form>
                    )}
                </div>
            )}
            
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
                            {['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'آخرین واحد', ...PERSIAN_MONTHS].map(header => (
                                <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading && <tr><td colSpan={16} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {error && <tr><td colSpan={16} className="text-center p-4 text-red-500">{error}</td></tr>}
                        {!loading && !error && bonusData.length === 0 && (
                            <tr><td colSpan={16} className="text-center p-8 text-gray-500 dark:text-gray-400"><DocumentReportIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />هیچ داده‌ای برای سال انتخاب شده یافت نشد.</td></tr>
                        )}
                        {!loading && !error && bonusData.map((person) => (
                            <tr key={person.personnel_code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{toPersianDigits(person.personnel_code)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-slate-200">{person.first_name} {person.last_name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{person.position || '---'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{getLatestDepartment(person.monthly_data)}</td>
                                {PERSIAN_MONTHS.map(month => (
                                    <td key={month} className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-slate-300">
                                        {toPersianDigits(person.monthly_data?.[month]?.bonus?.toLocaleString('fa-IR')) || '-'}
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