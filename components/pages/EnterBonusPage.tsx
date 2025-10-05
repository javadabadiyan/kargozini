import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BonusData } from '../../types';
import { DownloadIcon, UploadIcon, DocumentReportIcon, UserPlusIcon, PencilIcon, TrashIcon, SearchIcon } from '../icons/Icons';
import EditBonusModal from '../EditBonusModal';

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
    if (!value && value !== 0) return '';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const EnterBonusPage: React.FC = () => {
    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    const canView = useMemo(() => currentUser.permissions?.enter_bonus, [currentUser]);
    const username = useMemo(() => currentUser.full_name || currentUser.username, [currentUser]);

    const [selectedYear, setSelectedYear] = useState<number>(YEARS[0]);
    const [selectedMonth, setSelectedMonth] = useState<string>(PERSIAN_MONTHS[0]);
    const [bonusData, setBonusData] = useState<BonusData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Search and Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 20;

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingBonusInfo, setEditingBonusInfo] = useState<{ person: BonusData, month: string } | null>(null);

    // Manual entry states
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualEntry, setManualEntry] = useState({
        personnel_code: '', first_name: '', last_name: '', position: '', department: '', bonus_amount: '',
    });

    const fetchBonuses = useCallback(async (year: number) => {
        if (!canView) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=bonuses&year=${year}&user=${encodeURIComponent(username)}`);
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
    }, [canView, username]);

    useEffect(() => {
        fetchBonuses(selectedYear);
    }, [selectedYear, fetchBonuses]);

    const uniqueDepartments = useMemo(() => {
        const allDepartments = new Set<string>();
        bonusData.forEach(person => {
            if (person.monthly_data) {
                // FIX: Explicitly type monthData to allow access to 'department' property.
                Object.values(person.monthly_data).forEach((monthData: { bonus: number; department: string; }) => {
                    if (monthData.department) {
                        allDepartments.add(monthData.department);
                    }
                });
            }
        });
        return Array.from(allDepartments).sort((a, b) => a.localeCompare(b, 'fa'));
    }, [bonusData]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, departmentFilter]);

    const filteredBonusData = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        return bonusData.filter(person => {
            const nameMatch = `${person.first_name} ${person.last_name}`.toLowerCase().includes(lowercasedSearchTerm) ||
                              person.personnel_code.toLowerCase().includes(lowercasedSearchTerm);
            
            // FIX: Explicitly type md to allow access to 'department' property.
            const departmentMatch = departmentFilter === '' || 
                                    (person.monthly_data && Object.values(person.monthly_data).some((md: { bonus: number; department: string; }) => md.department === departmentFilter));

            return nameMatch && departmentMatch;
        });
    }, [bonusData, searchTerm, departmentFilter]);

    const paginatedBonusData = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return filteredBonusData.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredBonusData, currentPage]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredBonusData.length / PAGE_SIZE);
    }, [filteredBonusData]);
    
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
                    body: JSON.stringify({ year: selectedYear, month: selectedMonth, data: dataToUpload, submitted_by_user: username }),
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
        const headers: string[] = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'کاربر ثبت کننده'];
        PERSIAN_MONTHS.forEach(month => {
            headers.push(`کارانه ${month}`);
            headers.push(`واحد ${month}`);
        });
        
        const dataAsArray: any[][] = [headers];
        filteredBonusData.forEach(person => {
            const row: (string | number | undefined)[] = [
                person.personnel_code,
                `${person.first_name} ${person.last_name}`,
                person.position || '',
                person.submitted_by_user
            ];
            PERSIAN_MONTHS.forEach(month => {
                const monthData = person.monthly_data?.[month];
                row.push(monthData?.bonus ?? '');
                row.push(monthData?.department ?? '');
            });
            dataAsArray.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(dataAsArray);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `کارانه سال ${toPersianDigits(selectedYear)}`);
        XLSX.writeFile(workbook, `Bonus_Report_${selectedYear}.xlsx`);
    };

    const handleManualEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setManualEntry(prev => ({ ...prev, [name]: value }));
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { personnel_code, first_name, last_name, bonus_amount, department } = manualEntry;

        if (!personnel_code || !first_name || !last_name || !bonus_amount || !department) {
            setStatus({ type: 'error', message: 'لطفاً تمام فیلدهای الزامی را پر کنید.' });
            return;
        }

        setStatus({ type: 'info', message: `در حال ثبت کارانه برای ${first_name} ${last_name}...` });

        const dataToUpload = [{ ...manualEntry, bonus_value: Number(toEnglishDigits(manualEntry.bonus_amount).replace(/,/g, '')), }];

        try {
            const response = await fetch('/api/personnel?type=bonuses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year: selectedYear, month: selectedMonth, data: dataToUpload, submitted_by_user: username }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.details || result.error);
            
            setStatus({ type: 'success', message: result.message });
            fetchBonuses(selectedYear);
            setManualEntry({ personnel_code: '', first_name: '', last_name: '', position: '', department: '', bonus_amount: '' });

        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت کارانه' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleEditClick = (person: BonusData, month: string) => {
        setEditingBonusInfo({ person, month });
        setIsEditModalOpen(true);
    };

    const handleDeleteClick = async (id: number, month: string) => {
        if(window.confirm(`آیا از حذف کارانه ماه ${month} برای این پرسنل اطمینان دارید؟`)) {
            setStatus({ type: 'info', message: 'در حال حذف...'});
            try {
                const response = await fetch('/api/personnel?type=bonuses', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, month }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setStatus({ type: 'success', message: result.message });
                fetchBonuses(selectedYear);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
        }
    };

    const handleSaveEdit = async (id: number, month: string, bonus_value: number, department: string) => {
        setStatus({ type: 'info', message: 'در حال ذخیره تغییرات...' });
        try {
             const response = await fetch('/api/personnel?type=bonuses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, month, bonus_value, department }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setStatus({ type: 'success', message: result.message });
            fetchBonuses(selectedYear);
            setIsEditModalOpen(false);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleFinalize = async () => {
        if (window.confirm(`آیا از ارسال نهایی کارانه سال ${toPersianDigits(selectedYear)} اطمینان دارید؟ پس از ارسال، داده‌های شما در بایگانی ثبت می‌شود.`)) {
            setStatus({ type: 'info', message: 'در حال ارسال نهایی...'});
            try {
                const response = await fetch('/api/personnel?type=finalize_bonuses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ year: selectedYear, user: username })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setStatus({ type: 'success', message: result.message });
                fetchBonuses(selectedYear); 
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ارسال نهایی' });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
        }
    }

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

    const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'کاربر ثبت کننده', ...PERSIAN_MONTHS];
    const statusColor = { info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    const inputClass = "w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md";

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">ارسال کارانه</h2>
                 <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowManualForm(prev => !prev)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <UserPlusIcon className="w-4 h-4" /> {showManualForm ? 'بستن فرم' : 'افزودن دستی'}
                    </button>
                    <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500 dark:hover:bg-slate-500">
                        <DownloadIcon className="w-4 h-4" /> نمونه
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-bonus" accept=".xlsx, .xls" />
                    <label htmlFor="excel-import-bonus" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                        <UploadIcon className="w-4 h-4" /> ورود از اکسل
                    </label>
                    <button onClick={handleExport} disabled={bonusData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        <DownloadIcon className="w-4 h-4" /> خروجی
                    </button>
                </div>
            </div>

            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="my-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="search-input" className="block text-sm font-medium mb-1 dark:text-slate-300">جستجو</label>
                        <div className="relative">
                            <input 
                                id="search-input"
                                type="text" 
                                placeholder="بر اساس نام یا کد پرسنلی..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={inputClass} 
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="dept-filter" className="block text-sm font-medium mb-1 dark:text-slate-300">فیلتر بر اساس واحد</label>
                        <select
                            id="dept-filter"
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">همه واحدها</option>
                            {uniqueDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {showManualForm && (
                <div className="p-4 my-4 border rounded-lg bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 transition-all duration-300">
                    <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-4">ثبت دستی کارانه برای ماه {selectedMonth} سال {toPersianDigits(selectedYear)}</h3>
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div><label className="block text-sm mb-1">کد پرسنلی*</label><input name="personnel_code" value={manualEntry.personnel_code} onChange={handleManualEntryChange} className={inputClass} required /></div>
                            <div><label className="block text-sm mb-1">نام*</label><input name="first_name" value={manualEntry.first_name} onChange={handleManualEntryChange} className={inputClass} required /></div>
                            <div><label className="block text-sm mb-1">نام خانوادگی*</label><input name="last_name" value={manualEntry.last_name} onChange={handleManualEntryChange} className={inputClass} required /></div>
                            <div><label className="block text-sm mb-1">پست سازمانی</label><input name="position" value={manualEntry.position} onChange={handleManualEntryChange} className={inputClass} /></div>
                            <div><label className="block text-sm mb-1">واحد*</label><input name="department" value={manualEntry.department} onChange={handleManualEntryChange} className={inputClass} required /></div>
                            <div><label className="block text-sm mb-1">مبلغ کارانه (ریال)*</label><input name="bonus_amount" value={toPersianDigits(formatCurrency(manualEntry.bonus_amount))} onChange={handleManualEntryChange} className={`${inputClass} font-sans text-left`} required /></div>
                        </div>
                        <div className="flex justify-end mt-4"><button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">ثبت کارانه</button></div>
                    </form>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                <div>
                    <label htmlFor="year-select" className="block text-sm font-medium mb-2">انتخاب سال برای نمایش و ورود اطلاعات:</label>
                    <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                        {YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-select" className="block text-sm font-medium mb-2">انتخاب ماه برای فایل نمونه/ورود اطلاعات:</label>
                    <select id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600">
                        {PERSIAN_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold uppercase">{h}</th>)}</tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading && <tr><td colSpan={17} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {error && <tr><td colSpan={17} className="text-center p-4 text-red-500">{error}</td></tr>}
                        {!loading && !error && bonusData.length > 0 && filteredBonusData.length === 0 && (
                            <tr><td colSpan={17} className="text-center p-8 text-gray-500 dark:text-gray-400">هیچ رکوردی مطابق با فیلترهای اعمال شده یافت نشد.</td></tr>
                        )}
                        {!loading && !error && bonusData.length === 0 && (
                            <tr><td colSpan={17} className="text-center p-8 text-gray-500 dark:text-gray-400"><DocumentReportIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />هیچ داده‌ای برای سال انتخاب شده یافت نشد.</td></tr>
                        )}
                        {!loading && !error && paginatedBonusData.map((person) => (
                            <tr key={person.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(person.personnel_code)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">{person.first_name} {person.last_name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{person.position || '---'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">{person.submitted_by_user}</td>
                                {PERSIAN_MONTHS.map(month => {
                                    const monthData = person.monthly_data?.[month];
                                    return (
                                        <td key={month} className="px-2 py-3 whitespace-nowrap text-sm text-center">
                                            {monthData ? (
                                                <div className="flex flex-col items-center justify-center group relative p-1">
                                                    <span className="font-sans font-bold text-base">{toPersianDigits(formatCurrency(monthData.bonus))}</span>
                                                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{monthData.department}</span>
                                                    <div className="absolute -top-1 right-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-slate-900/80 p-1 rounded-md shadow-lg border dark:border-slate-600">
                                                        <button onClick={() => handleEditClick(person, month)} className="p-1 text-blue-600 hover:text-blue-500" title="ویرایش"><PencilIcon className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteClick(person.id, month)} className="p-1 text-red-600 hover:text-red-500" title="حذف"><TrashIcon className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            ) : ('-')}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             {/* Pagination and Finalize Button */}
             <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
                <button
                    onClick={handleFinalize}
                    className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 order-1 md:order-2"
                    disabled={bonusData.length === 0}
                >
                    ارسال نهایی کارانه
                </button>
                {!loading && !error && totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 order-2 md:order-1">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-500 disabled:opacity-50"
                        >
                            قبلی
                        </button>
                        <span className="text-sm text-gray-600 dark:text-slate-300">
                            صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}
                        </span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-500 disabled:opacity-50"
                        >
                            بعدی
                        </button>
                    </div>
                )}
            </div>
             {isEditModalOpen && editingBonusInfo && (
                <EditBonusModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveEdit}
                    person={editingBonusInfo.person}
                    month={editingBonusInfo.month}
                />
            )}
        </div>
    );
};

export default EnterBonusPage;