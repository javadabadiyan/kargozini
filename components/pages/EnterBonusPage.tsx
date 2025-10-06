import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BonusData, BonusEditLog } from '../../types';
import { DownloadIcon, UploadIcon, DocumentReportIcon, UserPlusIcon, PencilIcon, TrashIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon } from '../icons/Icons';
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

// New modal for editing a person's details in the bonus record
const EditBonusPersonModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (details: Pick<BonusData, 'id' | 'first_name' | 'last_name' | 'position' | 'service_location'>) => Promise<void>;
    person: BonusData;
}> = ({ isOpen, onClose, onSave, person }) => {
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        position: '',
        service_location: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (person) {
            setFormData({
                first_name: person.first_name,
                last_name: person.last_name,
                position: person.position || '',
                service_location: person.service_location || ''
            });
        }
    }, [person]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave({ id: person.id, ...formData });
        setIsSaving(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const inputClass = "w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                    <h3 className="text-xl font-semibold">ویرایش اطلاعات {person.first_name} {person.last_name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">نام</label>
                            <input name="first_name" value={formData.first_name} onChange={handleChange} className={inputClass} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">نام خانوادگی</label>
                            <input name="last_name" value={formData.last_name} onChange={handleChange} className={inputClass} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">پست سازمانی</label>
                            <input name="position" value={formData.position} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">محل خدمت</label>
                            <input name="service_location" value={formData.service_location} onChange={handleChange} className={inputClass} />
                        </div>
                    </div>
                    <div className="flex justify-end items-center p-4 border-t bg-gray-50 dark:bg-slate-900/50 dark:border-slate-700 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-6 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500" disabled={isSaving}>انصراف</button>
                        <button type="submit" className="mr-3 px-6 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700" disabled={isSaving}>
                            {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// Main Component
const EnterBonusPage: React.FC = () => {
    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    const canView = useMemo(() => currentUser.permissions?.enter_bonus, [currentUser]);
    const isAdmin = useMemo(() => currentUser.permissions?.user_management, [currentUser]);
    const username = useMemo(() => currentUser.full_name || currentUser.username, [currentUser]);
    
    const [activeView, setActiveView] = useState('table'); // 'table', 'analysis', 'audit'

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
    const [isPersonEditModalOpen, setIsPersonEditModalOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<BonusData | null>(null);


    // Manual entry states
    const [showManualForm, setShowManualForm] = useState(false);
    const [manualEntry, setManualEntry] = useState({
        personnel_code: '', first_name: '', last_name: '', position: '', service_location: '', department: '', bonus_amount: '',
    });
    
    // Audit Log State
    const [auditLogs, setAuditLogs] = useState<BonusEditLog[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const fetchBonuses = useCallback(async (year: number) => {
        if (!canView) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=bonuses&year=${year}&user=${encodeURIComponent(username)}`);
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در دریافت اطلاعات کارانه');
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
    
    useEffect(() => {
        if (activeView === 'audit' && isAdmin) {
            const fetchAuditLogs = async () => {
                setAuditLoading(true);
                try {
                    const response = await fetch('/api/personnel?type=bonus_edit_logs');
                    if (!response.ok) throw new Error('خطا در دریافت گزارش تغییرات');
                    const data = await response.json();
                    setAuditLogs(data.logs || []);
                } catch (err) {
                    setStatus({type: 'error', message: err instanceof Error ? err.message : 'خطا'});
                } finally {
                    setAuditLoading(false);
                }
            };
            fetchAuditLogs();
        }
    }, [activeView, isAdmin]);

    const uniqueDepartments = useMemo(() => {
        const allDepartments = new Set<string>();
        bonusData.forEach(person => {
            if (person.monthly_data) {
                Object.values(person.monthly_data).forEach((monthData: any) => {
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
            const departmentMatch = departmentFilter === '' || 
                                    (person.monthly_data && Object.values(person.monthly_data).some((md: any) => md.department === departmentFilter));
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
        const headers = ['کد پرسنلی', 'نام', 'نام خانوادگی', 'پست', 'محل خدمت', `واحد ${selectedMonth}`, `کارانه ${selectedMonth}`];
        XLSX.writeFile(XLSX.utils.book_new_from_data([headers]), `Sample_Bonus_${selectedMonth}.xlsx`);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                const dataToUpload = json.map(row => ({
                    personnel_code: String(row['کد پرسنلی'] || ''), first_name: String(row['نام'] || ''),
                    last_name: String(row['نام خانوادگی'] || ''), position: String(row['پست'] || ''),
                    service_location: String(row['محل خدمت'] || ''), department: String(row[`واحد ${selectedMonth}`] || ''),
                    bonus_value: row[`کارانه ${selectedMonth}`],
                })).filter(item => item.personnel_code && item.bonus_value !== undefined);
                
                if(dataToUpload.length === 0) throw new Error(`هیچ رکورد معتبری در فایل یافت نشد. از وجود ستون‌های 'کد پرسنلی' و 'کارانه ${selectedMonth}' اطمینان حاصل کنید.`);
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
        const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'محل خدمت', 'کاربر ثبت کننده', ...PERSIAN_MONTHS.flatMap(m => [`کارانه ${m}`, `واحد ${m}`])];
        const data = filteredBonusData.map(p => {
            const row = { 'کد پرسنلی': p.personnel_code, 'نام و نام خانوادگی': `${p.first_name} ${p.last_name}`, 'پست': p.position || '', 'محل خدمت': p.service_location || '', 'کاربر ثبت کننده': p.submitted_by_user };
            PERSIAN_MONTHS.forEach(m => {
                const md = p.monthly_data?.[m];
                (row as any)[`کارانه ${m}`] = md?.bonus ?? '';
                (row as any)[`واحد ${m}`] = md?.department ?? '';
            });
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `کارانه ${toPersianDigits(selectedYear)}`);
        XLSX.writeFile(workbook, `Bonus_Report_${selectedYear}.xlsx`);
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { personnel_code, first_name, last_name, bonus_amount, department } = manualEntry;
        if (!personnel_code || !first_name || !last_name || !bonus_amount || !department) {
            setStatus({ type: 'error', message: 'لطفاً تمام فیلدهای الزامی را پر کنید.' });
            return;
        }
        const dataToUpload = [{ ...manualEntry, bonus_value: Number(toEnglishDigits(manualEntry.bonus_amount).replace(/,/g, '')), }];
        setStatus({ type: 'info', message: 'در حال ثبت...' });
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
            setManualEntry({ personnel_code: '', first_name: '', last_name: '', position: '', service_location: '', department: '', bonus_amount: '' });
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleSaveEdit = async (id: number, month: string, bonus_value: number, department: string) => {
        setStatus({ type: 'info', message: 'در حال ذخیره...' });
        try {
             const response = await fetch('/api/personnel?type=bonuses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, month, bonus_value, department, editor_name: username }),
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

    const handleDeleteClick = async (id: number, month: string) => {
        if(window.confirm(`آیا از حذف کارانه ماه ${month} برای این پرسنل اطمینان دارید؟`)) {
            setStatus({ type: 'info', message: 'در حال حذف...'});
            try {
                const response = await fetch('/api/personnel?type=bonuses', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, month, editor_name: username }),
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

    const handleFinalize = async () => {
        if (window.confirm(`آیا از ارسال نهایی کارانه سال ${toPersianDigits(selectedYear)} اطمینان دارید؟ پس از ارسال، اطلاعات از این صفحه به بایگانی منتقل شده و قابل ویرایش نخواهد بود.`)) {
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
    };
    
    const handleDeleteAll = async () => {
        if (window.confirm(`این عمل تمام اطلاعات کارانه ثبت شده توسط شما برای سال ${toPersianDigits(selectedYear)} را حذف می‌کند. آیا مطمئن هستید؟`)) {
            setStatus({ type: 'info', message: 'در حال حذف تمام داده‌ها...'});
            try {
                const response = await fetch(`/api/personnel?type=bonuses&deleteAllForUser=true&year=${selectedYear}&user=${encodeURIComponent(username)}`, {
                    method: 'DELETE',
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setStatus({ type: 'success', message: result.message });
                fetchBonuses(selectedYear); 
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف کلی' });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
        }
    };

    const handlePersonEditClick = (person: BonusData) => {
        setEditingPerson(person);
        setIsPersonEditModalOpen(true);
    };

    const handlePersonDeleteClick = async (id: number) => {
        if (window.confirm('آیا از حذف تمام اطلاعات کارانه این شخص برای سال انتخاب شده اطمینان دارید؟')) {
            setStatus({ type: 'info', message: 'در حال حذف رکورد...' });
            try {
                const response = await fetch('/api/personnel?type=bonuses', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, delete_person_record: true }),
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

    const handleSavePersonDetails = async (personDetails: Pick<BonusData, 'id' | 'first_name' | 'last_name' | 'position' | 'service_location'>) => {
        setStatus({ type: 'info', message: 'در حال ذخیره اطلاعات پرسنل...' });
        try {
            const response = await fetch('/api/personnel?type=bonuses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: personDetails.id, person_details: personDetails }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setStatus({ type: 'success', message: result.message });
            fetchBonuses(selectedYear);
            setIsPersonEditModalOpen(false);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    if (!canView) {
        return <div className="p-6 text-center"><h2 className="text-2xl font-bold mb-4">عدم دسترسی</h2><p>شما به این صفحه دسترسی ندارید.</p></div>;
    }

    const tabClass = (viewName: string) => `px-4 py-2 font-semibold transition-colors duration-200 ${activeView === viewName ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'}`;
    const statusColor = { info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300', success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300', error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-4">ارسال کارانه</h2>
            <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
                <nav className="flex space-x-4 space-x-reverse">
                    <button className={tabClass('table')} onClick={() => setActiveView('table')}>جدول داده‌ها</button>
                    <button className={tabClass('analysis')} onClick={() => setActiveView('analysis')}>تحلیل هوشمند</button>
                    {isAdmin && <button className={tabClass('audit')} onClick={() => setActiveView('audit')}>گزارش تغییرات</button>}
                </nav>
            </div>
            
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            {activeView === 'table' && <BonusDataTable {...{loading, error, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, bonusData, filteredBonusData, paginatedBonusData, currentPage, totalPages, setCurrentPage, searchTerm, setSearchTerm, departmentFilter, setDepartmentFilter, uniqueDepartments, showManualForm, setShowManualForm, manualEntry, setManualEntry, handleManualSubmit, fileInputRef, handleDownloadSample, handleFileImport, handleExport, handleEditClick: (p: BonusData, m: string) => { setEditingBonusInfo({ person: p, month: m }); setIsEditModalOpen(true); }, handleDeleteClick, handleFinalize, handleDeleteAll, handlePersonEditClick, handlePersonDeleteClick }} />}
            {activeView === 'analysis' && <BonusAnalysis bonusData={bonusData} allDepartments={uniqueDepartments} />}
            {activeView === 'audit' && isAdmin && <AuditLogView logs={auditLogs} loading={auditLoading} />}

            {isEditModalOpen && editingBonusInfo && (
                <EditBonusModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveEdit}
                    person={editingBonusInfo.person}
                    month={editingBonusInfo.month}
                />
            )}
            {isPersonEditModalOpen && editingPerson && (
                <EditBonusPersonModal
                    isOpen={isPersonEditModalOpen}
                    onClose={() => setIsPersonEditModalOpen(false)}
                    onSave={handleSavePersonDetails}
                    person={editingPerson}
                />
            )}
        </div>
    );
};

const BonusDataTable = ({ loading, error, selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, bonusData, paginatedBonusData, currentPage, totalPages, setCurrentPage, searchTerm, setSearchTerm, departmentFilter, setDepartmentFilter, uniqueDepartments, showManualForm, setShowManualForm, manualEntry, setManualEntry, handleManualSubmit, fileInputRef, handleDownloadSample, handleFileImport, handleExport, handleEditClick, handleDeleteClick, handleFinalize, handleDeleteAll, handlePersonEditClick, handlePersonDeleteClick }: any) => {
    const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'محل خدمت', 'کاربر ثبت کننده', ...PERSIAN_MONTHS, 'عملیات'];
    const inputClass = "w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md";
    
    return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setShowManualForm((p: boolean) => !p)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><UserPlusIcon className="w-4 h-4" /> {showManualForm ? 'بستن فرم' : 'افزودن دستی'}</button>
                <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:bg-slate-600 dark:text-slate-200 dark:border-slate-500 dark:hover:bg-slate-500"><DownloadIcon className="w-4 h-4" /> نمونه</button>
                <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-bonus" accept=".xlsx, .xls" />
                <label htmlFor="excel-import-bonus" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"><UploadIcon className="w-4 h-4" /> ورود از اکسل</label>
                <button onClick={handleExport} disabled={bonusData.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"><DownloadIcon className="w-4 h-4" /> خروجی</button>
            </div>
        </div>
        
        {showManualForm && (
            <div className="p-4 my-4 border rounded-lg bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 transition-all duration-300">
                <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-200 mb-4">ثبت دستی کارانه برای ماه {selectedMonth} سال {toPersianDigits(selectedYear)}</h3>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div><label className="block text-sm mb-1">کد پرسنلی*</label><input name="personnel_code" value={manualEntry.personnel_code} onChange={(e) => setManualEntry({ ...manualEntry, personnel_code: e.target.value })} className={inputClass} required /></div>
                        <div><label className="block text-sm mb-1">نام*</label><input name="first_name" value={manualEntry.first_name} onChange={(e) => setManualEntry({ ...manualEntry, first_name: e.target.value })} className={inputClass} required /></div>
                        <div><label className="block text-sm mb-1">نام خانوادگی*</label><input name="last_name" value={manualEntry.last_name} onChange={(e) => setManualEntry({ ...manualEntry, last_name: e.target.value })} className={inputClass} required /></div>
                        <div><label className="block text-sm mb-1">پست سازمانی</label><input name="position" value={manualEntry.position} onChange={(e) => setManualEntry({ ...manualEntry, position: e.target.value })} className={inputClass} /></div>
                        <div><label className="block text-sm mb-1">محل خدمت</label><input name="service_location" value={manualEntry.service_location} onChange={(e) => setManualEntry({ ...manualEntry, service_location: e.target.value })} className={inputClass} /></div>
                        <div><label className="block text-sm mb-1">واحد*</label><input name="department" value={manualEntry.department} onChange={(e) => setManualEntry({ ...manualEntry, department: e.target.value })} className={inputClass} required /></div>
                        <div><label className="block text-sm mb-1">مبلغ کارانه (ریال)*</label><input name="bonus_amount" value={toPersianDigits(formatCurrency(manualEntry.bonus_amount))} onChange={(e) => setManualEntry({ ...manualEntry, bonus_amount: e.target.value })} className={`${inputClass} font-sans text-left`} required /></div>
                    </div>
                    <div className="flex justify-end mt-4"><button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">ثبت کارانه</button></div>
                </form>
            </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
            <div>
                <label className="block text-sm font-medium mb-1">انتخاب سال:</label>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={inputClass}>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">انتخاب ماه (برای ورود):</label>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={inputClass}>{PERSIAN_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
            </div>
             <div>
                <label className="block text-sm font-medium mb-1">جستجو:</label>
                <div className="relative"><input type="text" placeholder="نام یا کد پرسنلی..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass} /><SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /></div>
            </div>
             <div>
                <label className="block text-sm font-medium mb-1">فیلتر واحد:</label>
                <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className={inputClass}><option value="">همه واحدها</option>{uniqueDepartments.map((d:string) => <option key={d} value={d}>{d}</option>)}</select>
            </div>
        </div>
        
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                <thead className="bg-gray-100 dark:bg-slate-700/50"><tr>{headers.map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold uppercase">{h}</th>)}</tr></thead>
                <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                    {loading && <tr><td colSpan={18} className="text-center p-4">در حال بارگذاری...</td></tr>}
                    {error && <tr><td colSpan={18} className="text-center p-4 text-red-500">{error}</td></tr>}
                    {!loading && !error && paginatedBonusData.length === 0 && (<tr><td colSpan={18} className="text-center p-8 text-gray-500"><DocumentReportIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />{bonusData.length > 0 ? 'رکوردی مطابق فیلتر یافت نشد.' : 'داده‌ای برای این سال یافت نشد.'}</td></tr>)}
                    {!loading && !error && paginatedBonusData.map((person: BonusData) => (
                        <tr key={person.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-3 text-sm">{toPersianDigits(person.personnel_code)}</td>
                            <td className="px-4 py-3 text-sm font-semibold">{person.first_name} {person.last_name}</td>
                            <td className="px-4 py-3 text-sm">{person.position || '---'}</td>
                            <td className="px-4 py-3 text-sm">{person.service_location || '---'}</td>
                            <td className="px-4 py-3 text-sm">{person.submitted_by_user}</td>
                            {PERSIAN_MONTHS.map(month => {
                                const monthData = person.monthly_data?.[month];
                                return (
                                    <td key={month} className="px-2 py-3 text-sm text-center">
                                        {monthData ? (
                                            <div className="flex flex-col items-center group relative p-1">
                                                <span className="font-sans font-bold text-base">{toPersianDigits(formatCurrency(monthData.bonus))}</span>
                                                <span className="text-xs text-slate-500 mt-1">{monthData.department}</span>
                                                <div className="absolute -top-1 right-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 dark:bg-slate-900/80 p-1 rounded-md shadow-lg border dark:border-slate-600">
                                                    <button onClick={() => handleEditClick(person, month)} className="p-1 text-blue-600 hover:text-blue-500" title="ویرایش"><PencilIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleDeleteClick(person.id, month)} className="p-1 text-red-600 hover:text-red-500" title="حذف"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </div>
                                        ) : ('-')}
                                    </td>
                                );
                            })}
                             <td className="px-4 py-3 text-sm">
                                <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => handlePersonEditClick(person)} className="p-1 text-blue-600 hover:text-blue-500" title="ویرایش اطلاعات شخص"><PencilIcon className="w-5 h-5" /></button>
                                    <button onClick={() => handlePersonDeleteClick(person.id)} className="p-1 text-red-600 hover:text-red-500" title="حذف کل رکورد شخص"><TrashIcon className="w-5 h-5" /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
            <div className="flex gap-2 order-2 md:order-1">
                 <button onClick={handleFinalize} className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700" disabled={bonusData.length === 0}>ارسال نهایی کارانه</button>
                 <button onClick={handleDeleteAll} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50" disabled={bonusData.length === 0}>حذف اطلاعات سال {toPersianDigits(selectedYear)}</button>
            </div>
            {!loading && !error && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 order-1 md:order-2">
                    <button onClick={() => setCurrentPage((p:number) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                    <span className="text-sm">صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                    <button onClick={() => setCurrentPage((p:number) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                </div>
            )}
        </div>
    </div>
    );
};

const BonusAnalysis = ({ bonusData, allDepartments }: { bonusData: BonusData[], allDepartments: string[] }) => {
    const ANALYSIS_PAGE_SIZE = 10;
    const [selectedMonth, setSelectedMonth] = useState<string>(PERSIAN_MONTHS[new Date().getMonth()]);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    const [changeReportPositionFilter, setChangeReportPositionFilter] = useState<string>('');

    // Pagination states for different sections
    const [departmentSummaryPage, setDepartmentSummaryPage] = useState(1);
    const [positionSummaryPage, setPositionSummaryPage] = useState(1);
    const [changeReportPage, setChangeReportPage] = useState(1);
    const [serviceLocationPage, setServiceLocationPage] = useState(1);
    const [deptMonthlyPage, setDeptMonthlyPage] = useState(1);
    const [posMonthlyPage, setPosMonthlyPage] = useState(1);

    // State for month-to-month comparison
    const [compareMonth1, setCompareMonth1] = useState(PERSIAN_MONTHS[0]);
    const [compareMonth2, setCompareMonth2] = useState(PERSIAN_MONTHS[1]);
    
    // State for details modal
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; data: any[] }>({ title: '', data: [] });

    useEffect(() => {
        setDepartmentSummaryPage(1);
        setPositionSummaryPage(1);
        setChangeReportPage(1);
        setServiceLocationPage(1);
        setDeptMonthlyPage(1);
        setPosMonthlyPage(1);
    }, [selectedMonth, selectedDepartment]);

    useEffect(() => {
        setChangeReportPage(1);
    }, [changeReportPositionFilter]);


    const analysisData = useMemo(() => {
        if (!bonusData || bonusData.length === 0) return null;

        const flatData = bonusData.flatMap(person => 
            Object.entries(person.monthly_data || {}).map(([month, monthData]) => ({
                ...person,
                month,
                bonus: (monthData as any).bonus,
                department: (monthData as any).department,
            }))
        );

        const filteredByDept = selectedDepartment ? flatData.filter(d => d.department === selectedDepartment) : flatData;
        const monthData = filteredByDept.filter(d => d.month === selectedMonth && d.bonus > 0);

        const summary = {
            total: monthData.reduce((sum, d) => sum + d.bonus, 0),
            count: monthData.length,
            avg: monthData.length > 0 ? monthData.reduce((sum, d) => sum + d.bonus, 0) / monthData.length : 0,
            max: Math.max(0, ...monthData.map(d => d.bonus)),
            min: Math.min(...monthData.map(d => d.bonus).filter(b => b > 0), Infinity),
        };
        const maxPerson = monthData.find(d => d.bonus === summary.max);
        const minPerson = monthData.find(d => d.bonus === summary.min);
        
        const byServiceLocation = monthData.reduce((acc, d) => {
            const location = d.service_location || 'نامشخص';
            acc[location] = (acc[location] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byGroup = (key: 'department' | 'position') => {
            const groups = monthData.reduce((acc, d) => {
                const groupKey = (d as any)[key] || 'نامشخص';
                if (!acc[groupKey]) acc[groupKey] = { sum: 0, count: 0, bonuses: [], people: [] };
                acc[groupKey].sum += d.bonus;
                acc[groupKey].count++;
                acc[groupKey].bonuses.push(d.bonus);
                acc[groupKey].people.push(`${d.first_name} ${d.last_name}`);
                return acc;
            }, {} as any);

            return Object.entries(groups).map(([name, data]: [string, any]) => {
                const min = Math.min(...data.bonuses);
                const max = Math.max(...data.bonuses);
                return { name, sum: data.sum, count: data.count, avg: data.sum / data.count, min, max, minPerson: data.people[data.bonuses.indexOf(min)], maxPerson: data.people[data.bonuses.indexOf(max)] };
            }).sort((a,b) => b.sum - a.sum);
        };
        
        const changes = bonusData.flatMap(person => {
            const monthChanges: any[] = [];
            for (let i = 1; i < PERSIAN_MONTHS.length; i++) {
                const currentMonth = PERSIAN_MONTHS[i];
                const prevMonth = PERSIAN_MONTHS[i - 1];
                const currentBonusData = person.monthly_data?.[currentMonth];
                const prevBonusData = person.monthly_data?.[prevMonth];

                if (currentBonusData?.bonus !== undefined && prevBonusData?.bonus !== undefined) {
                    const bonusChanged = currentBonusData.bonus !== prevBonusData.bonus;
                    const departmentChanged = currentBonusData.department !== prevBonusData.department;
                    
                    if (bonusChanged || departmentChanged) {
                        monthChanges.push({
                            person: `${person.first_name} ${person.last_name}`,
                            position: person.position || 'نامشخص',
                            month: currentMonth,
                            prevBonus: prevBonusData.bonus,
                            currentBonus: currentBonusData.bonus,
                            bonusDiff: currentBonusData.bonus - prevBonusData.bonus,
                            prevDepartment: prevBonusData.department,
                            currentDepartment: currentBonusData.department,
                            departmentChanged: departmentChanged,
                        });
                    }
                }
            }
            return monthChanges;
        });

        return { summary, maxPerson, minPerson, byDepartment: byGroup('department'), byPosition: byGroup('position'), byServiceLocation: Object.entries(byServiceLocation).sort((a,b) => b[1] - a[1]), changes, monthDataForCards: monthData };
    }, [bonusData, selectedMonth, selectedDepartment]);
    
    const comparisonData = useMemo(() => {
        if (!bonusData) return null;
        const total1 = bonusData.reduce((sum, p) => sum + (p.monthly_data?.[compareMonth1]?.bonus || 0), 0);
        const total2 = bonusData.reduce((sum, p) => sum + (p.monthly_data?.[compareMonth2]?.bonus || 0), 0);
        const diff = total2 - total1;
        const percent = total1 > 0 ? (diff / total1) * 100 : (total2 > 0 ? 100 : 0);
        return { total1, total2, diff, percent };
    }, [bonusData, compareMonth1, compareMonth2]);

    const monthlyBreakdownData = useMemo(() => {
        const byDepartment: { [dept: string]: { [month: string]: number } } = {};
        const byPosition: { [pos: string]: { [month: string]: number } } = {};

        bonusData.forEach(person => {
            Object.entries(person.monthly_data || {}).forEach(([month, monthData]) => {
                const { bonus, department } = monthData as any;
                const position = person.position || 'نامشخص';

                if (department) {
                    if (!byDepartment[department]) byDepartment[department] = {};
                    byDepartment[department][month] = (byDepartment[department][month] || 0) + bonus;
                }
                if (position) {
                    if (!byPosition[position]) byPosition[position] = {};
                    byPosition[position][month] = (byPosition[position][month] || 0) + bonus;
                }
            });
        });

        return { 
            byDepartment: Object.entries(byDepartment).sort((a,b) => a[0].localeCompare(b[0], 'fa')), 
            byPosition: Object.entries(byPosition).sort((a,b) => a[0].localeCompare(b[0], 'fa')), 
        };
    }, [bonusData]);

    const monthlyTrendData = useMemo(() => {
        if (!bonusData || bonusData.length === 0) return [];

        const filteredByDept = selectedDepartment
            ? bonusData.filter(person =>
                person.monthly_data && Object.values(person.monthly_data).some((md: any) => md.department === selectedDepartment)
            )
            : bonusData;

        const monthlyTotals = PERSIAN_MONTHS.map(month => {
            const total = filteredByDept.reduce((sum, person) => {
                const monthBonus = person.monthly_data?.[month]?.bonus;
                return sum + (monthBonus || 0);
            }, 0);
            return { month, total };
        });

        const trend = monthlyTotals.map((data, index) => {
            if (index === 0) {
                return { ...data, change: 0, percentage: 0 };
            }
            const prevTotal = monthlyTotals[index - 1].total;
            const change = data.total - prevTotal;
            const percentage = prevTotal > 0 ? (change / prevTotal) * 100 : (change > 0 ? 100 : 0);
            return { ...data, change, percentage };
        });

        return trend;

    }, [bonusData, selectedDepartment]);
    
    const handleCardClick = (type: 'total' | 'highest' | 'lowest' | 'average') => {
        if (!analysisData) return;
        
        let title = '';
        let data: any[] = [];
        const monthData = analysisData.monthDataForCards;
        
        switch(type) {
            case 'total':
            case 'average':
                title = `لیست افراد (${toPersianDigits(monthData.length)} نفر)`;
                data = monthData;
                break;
            case 'highest':
                title = 'دریافت کنندگان بیشترین کارانه';
                data = monthData.filter(d => d.bonus === analysisData.summary.max);
                break;
            case 'lowest':
                title = 'دریافت کنندگان کمترین کارانه';
                data = monthData.filter(d => d.bonus === analysisData.summary.min);
                break;
        }
        
        setModalContent({
            title,
            data: data.map(p => ({
                name: `${p.first_name} ${p.last_name}`,
                bonus: p.bonus,
                department: p.department,
                position: p.position || 'نامشخص'
            }))
        });
        setIsDetailModalOpen(true);
    };

    const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex justify-center items-center gap-4 mt-4">
                <button onClick={() => onPageChange(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm bg-white dark:bg-slate-800 border dark:border-slate-600 rounded disabled:opacity-50">قبلی</button>
                <span className="text-sm">صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                <button onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm bg-white dark:bg-slate-800 border dark:border-slate-600 rounded disabled:opacity-50">بعدی</button>
            </div>
        );
    };

    if (!analysisData) {
        return <div className="p-4 text-center text-gray-500 dark:text-slate-400">داده‌ای برای تحلیل وجود ندارد. لطفاً ابتدا اطلاعات کارانه را وارد کنید.</div>;
    }
    
    const AnalysisCard = ({ title, value, subtext }: { title: string, value: string, subtext?: string }) => (
        <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg shadow">
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400">{title}</h4>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-sans">{value}</p>
            {subtext && <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{subtext}</p>}
        </div>
    );
    
    const AnalysisSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <details className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600" open>
            <summary className="p-3 font-bold text-lg cursor-pointer flex justify-between items-center list-none">
                {title}
                <ChevronDownIcon className="w-5 h-5 transition-transform duration-200 details-arrow" />
            </summary>
            <div className="p-4 border-t dark:border-slate-600">{children}</div>
            <style>{`details summary::-webkit-details-marker { display: none; } details[open] .details-arrow { transform: rotate(180deg); }`}</style>
        </details>
    );
    
    const maxDeptSum = Math.max(1, ...analysisData.byDepartment.map(i => i.sum));
    const maxPositionSum = Math.max(1, ...analysisData.byPosition.map(i => i.sum));
    
    // Pagination logic for analysis tables
    const departmentSummaryTotalPages = Math.ceil(analysisData.byDepartment.length / ANALYSIS_PAGE_SIZE);
    const paginatedDepartmentSummary = analysisData.byDepartment.slice((departmentSummaryPage - 1) * ANALYSIS_PAGE_SIZE, departmentSummaryPage * ANALYSIS_PAGE_SIZE);
    const positionSummaryTotalPages = Math.ceil(analysisData.byPosition.length / ANALYSIS_PAGE_SIZE);
    const paginatedPositionSummary = analysisData.byPosition.slice((positionSummaryPage - 1) * ANALYSIS_PAGE_SIZE, positionSummaryPage * ANALYSIS_PAGE_SIZE);
    const serviceLocationTotalPages = Math.ceil(analysisData.byServiceLocation.length / ANALYSIS_PAGE_SIZE);
    const paginatedServiceLocation = analysisData.byServiceLocation.slice((serviceLocationPage - 1) * ANALYSIS_PAGE_SIZE, serviceLocationPage * ANALYSIS_PAGE_SIZE);
    const filteredChanges = analysisData.changes.filter(c => !changeReportPositionFilter || c.position === changeReportPositionFilter);
    const changeReportTotalPages = Math.ceil(filteredChanges.length / ANALYSIS_PAGE_SIZE);
    const paginatedChanges = filteredChanges.slice((changeReportPage - 1) * ANALYSIS_PAGE_SIZE, changeReportPage * ANALYSIS_PAGE_SIZE);
    const deptMonthlyTotalPages = Math.ceil(monthlyBreakdownData.byDepartment.length / ANALYSIS_PAGE_SIZE);
    const paginatedDeptMonthly = monthlyBreakdownData.byDepartment.slice((deptMonthlyPage - 1) * ANALYSIS_PAGE_SIZE, deptMonthlyPage * ANALYSIS_PAGE_SIZE);
    const posMonthlyTotalPages = Math.ceil(monthlyBreakdownData.byPosition.length / ANALYSIS_PAGE_SIZE);
    const paginatedPosMonthly = monthlyBreakdownData.byPosition.slice((posMonthlyPage - 1) * ANALYSIS_PAGE_SIZE, posMonthlyPage * ANALYSIS_PAGE_SIZE);


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg border dark:border-slate-700">
                <div className="flex-1">
                    <label className="text-sm font-medium">ماه مورد تحلیل:</label>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 mt-1"><option value="">انتخاب ماه</option>{PERSIAN_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                </div>
                <div className="flex-1">
                    <label className="text-sm font-medium">فیلتر واحد:</label>
                    <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 mt-1"><option value="">همه واحدها</option>{allDepartments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                </div>
            </div>
            
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => handleCardClick('total')} className="cursor-pointer hover:scale-105 transition-transform duration-200"><AnalysisCard title="جمع کل کارانه" value={toPersianDigits(formatCurrency(analysisData.summary.total))} subtext={`برای ${toPersianDigits(analysisData.summary.count)} نفر`} /></div>
                <div onClick={() => handleCardClick('average')} className="cursor-pointer hover:scale-105 transition-transform duration-200"><AnalysisCard title="میانگین کارانه" value={toPersianDigits(formatCurrency(Math.round(analysisData.summary.avg)))} /></div>
                <div onClick={() => handleCardClick('highest')} className="cursor-pointer hover:scale-105 transition-transform duration-200"><AnalysisCard title="بیشترین کارانه" value={toPersianDigits(formatCurrency(analysisData.summary.max))} subtext={analysisData.maxPerson ? `${analysisData.maxPerson.first_name} ${analysisData.maxPerson.last_name}` : ''} /></div>
                <div onClick={() => handleCardClick('lowest')} className="cursor-pointer hover:scale-105 transition-transform duration-200"><AnalysisCard title="کمترین کارانه" value={toPersianDigits(formatCurrency(analysisData.summary.min === Infinity ? 0 : analysisData.summary.min))} subtext={analysisData.minPerson ? `${analysisData.minPerson.first_name} ${analysisData.minPerson.last_name}` : ''} /></div>
            </div>

            <div className="space-y-4">
                <AnalysisSection title="مقایسه مستقیم ماه به ماه">
                    {comparisonData && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-sm">ماه اول</label><select value={compareMonth1} onChange={e => setCompareMonth1(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600 mt-1">{PERSIAN_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                                <div><label className="text-sm">ماه دوم</label><select value={compareMonth2} onChange={e => setCompareMonth2(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600 mt-1">{PERSIAN_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg"><h4>{compareMonth1}</h4><p className="font-bold font-sans text-lg">{toPersianDigits(formatCurrency(comparisonData.total1))}</p></div>
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg"><h4>{compareMonth2}</h4><p className="font-bold font-sans text-lg">{toPersianDigits(formatCurrency(comparisonData.total2))}</p></div>
                                <div className={`p-3 rounded-lg ${comparisonData.diff > 0 ? 'bg-green-100 dark:bg-green-900/50' : comparisonData.diff < 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    <h4>تغییر</h4>
                                    <p className={`font-bold font-sans text-lg ${comparisonData.diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {comparisonData.diff !== 0 ? `${comparisonData.diff > 0 ? '▲' : '▼'} ${toPersianDigits(formatCurrency(Math.abs(comparisonData.diff)))} (${toPersianDigits(comparisonData.percent.toFixed(1))}%)` : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </AnalysisSection>

                <AnalysisSection title="تجمیع کارانه هر واحد بر اساس ماه">
                     <div className="overflow-x-auto"><table className="w-full text-sm text-center"><thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right">واحد</th>{PERSIAN_MONTHS.map(m => <th key={m} className="p-2">{m}</th>)}</tr></thead><tbody>{paginatedDeptMonthly.map(([dept, monthsData]) => (<tr key={dept} className="border-b dark:border-slate-600 last:border-b-0 hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 text-right font-semibold">{dept}</td>{PERSIAN_MONTHS.map(m => <td key={m} className="p-2 font-sans">{monthsData[m] ? toPersianDigits(formatCurrency(monthsData[m])) : '-'}</td>)}</tr>))}</tbody></table></div>
                     <PaginationControls currentPage={deptMonthlyPage} totalPages={deptMonthlyTotalPages} onPageChange={setDeptMonthlyPage} />
                </AnalysisSection>

                <AnalysisSection title="تجمیع کارانه هر ماه براساس پست">
                     <div className="overflow-x-auto"><table className="w-full text-sm text-center"><thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right">پست</th>{PERSIAN_MONTHS.map(m => <th key={m} className="p-2">{m}</th>)}</tr></thead><tbody>{paginatedPosMonthly.map(([pos, monthsData]) => (<tr key={pos} className="border-b dark:border-slate-600 last:border-b-0 hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 text-right font-semibold">{pos}</td>{PERSIAN_MONTHS.map(m => <td key={m} className="p-2 font-sans">{monthsData[m] ? toPersianDigits(formatCurrency(monthsData[m])) : '-'}</td>)}</tr>))}</tbody></table></div>
                     <PaginationControls currentPage={posMonthlyPage} totalPages={posMonthlyTotalPages} onPageChange={setPosMonthlyPage} />
                </AnalysisSection>

                 <AnalysisSection title="تعداد نفرات بر اساس محل خدمت">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right">محل خدمت</th><th className="p-2 text-center">تعداد نفرات</th></tr></thead>
                            <tbody>{paginatedServiceLocation.map(([location, count]) => (<tr key={location} className="border-b dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 font-semibold">{location}</td><td className="p-2 text-center font-bold">{toPersianDigits(count)}</td></tr>))}</tbody>
                        </table>
                    </div>
                    <PaginationControls currentPage={serviceLocationPage} totalPages={serviceLocationTotalPages} onPageChange={setServiceLocationPage} />
                </AnalysisSection>

                <AnalysisSection title={`خلاصه بر اساس واحد (ماه ${selectedMonth})`}>
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right">واحد</th><th className="p-2">تجمعی</th><th className="p-2">میانگین</th><th className="p-2">تعداد</th><th className="p-2">بیشترین</th><th className="p-2">کمترین</th></tr></thead><tbody>{paginatedDepartmentSummary.map(d=><tr key={d.name} className="border-b dark:border-slate-600 text-center hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 text-right font-semibold">{d.name}</td><td className="p-2 font-sans">{toPersianDigits(formatCurrency(d.sum))}</td><td className="p-2 font-sans">{toPersianDigits(formatCurrency(Math.round(d.avg)))}</td><td className="p-2">{toPersianDigits(d.count)}</td><td className="p-2">{toPersianDigits(formatCurrency(d.max))} <span className="text-xs text-slate-500">({d.maxPerson})</span></td><td className="p-2">{toPersianDigits(formatCurrency(d.min))} <span className="text-xs text-slate-500">({d.minPerson})</span></td></tr>)}</tbody></table></div>
                     <PaginationControls currentPage={departmentSummaryPage} totalPages={departmentSummaryTotalPages} onPageChange={setDepartmentSummaryPage} />
                </AnalysisSection>
                
                <AnalysisSection title={`خلاصه بر اساس پست سازمانی (ماه ${selectedMonth})`}>
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right">پست</th><th className="p-2">تجمعی</th><th className="p-2">میانگین</th><th className="p-2">تعداد</th><th className="p-2">بیشترین</th><th className="p-2">کمترین</th></tr></thead><tbody>{paginatedPositionSummary.map(d=><tr key={d.name} className="border-b dark:border-slate-600 text-center hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 text-right font-semibold">{d.name}</td><td className="p-2 font-sans">{toPersianDigits(formatCurrency(d.sum))}</td><td className="p-2 font-sans">{toPersianDigits(formatCurrency(Math.round(d.avg)))}</td><td className="p-2">{toPersianDigits(d.count)}</td><td className="p-2">{toPersianDigits(formatCurrency(d.max))} <span className="text-xs text-slate-500">({d.maxPerson})</span></td><td className="p-2">{toPersianDigits(formatCurrency(d.min))} <span className="text-xs text-slate-500">({d.minPerson})</span></td></tr>)}</tbody></table></div>
                    <PaginationControls currentPage={positionSummaryPage} totalPages={positionSummaryTotalPages} onPageChange={setPositionSummaryPage} />
                </AnalysisSection>

                <AnalysisSection title="تحلیل روند ماهانه">
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right font-semibold">ماه</th><th className="p-2 text-center font-semibold">مجموع کارانه</th><th className="p-2 text-center font-semibold">تغییر نسبت به ماه قبل</th></tr></thead><tbody>{monthlyTrendData.map(({ month, total, change, percentage }, index) => (<tr key={month} className="border-b dark:border-slate-600 last:border-b-0 hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 font-semibold">{month}</td><td className="p-2 text-center font-sans">{toPersianDigits(formatCurrency(total))}</td><td className={`p-2 text-center font-sans font-bold flex items-center justify-center gap-2 ${change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{index > 0 && total > 0 ? (<>{change !== 0 ? (<><span>{change > 0 ? '▲' : '▼'}</span><span>{toPersianDigits(formatCurrency(Math.abs(change)))}</span><span className="text-xs opacity-80">({toPersianDigits(percentage.toFixed(1))}%)</span></>) : (<span>-</span>)}</>) : (<span>-</span>)}</td></tr>))}</tbody></table></div>
                </AnalysisSection>

                <AnalysisSection title={`مقایسه ماهانه واحدها (ماه ${selectedMonth})`}>
                    <div className="overflow-x-auto p-2"><div className="space-y-2" style={{minWidth: `${analysisData.byDepartment.length * 80}px`}}>{analysisData.byDepartment.map(d => (<div key={d.name} className="flex items-center gap-2"><span className="w-32 text-sm text-left shrink-0">{d.name}</span><div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-6 relative"><div className="bg-blue-500 h-6 rounded-full text-white text-xs flex items-center justify-end px-2" style={{ width: `${(d.sum / maxDeptSum) * 100}%` }}><span className="font-sans font-semibold">{toPersianDigits(formatCurrency(d.sum))}</span></div></div></div>))}</div></div>
                </AnalysisSection>

                <AnalysisSection title={`مقایسه تجمعی بر اساس پست (ماه ${selectedMonth})`}>
                     <div className="overflow-x-auto p-2"><div className="space-y-2" style={{minWidth: `${analysisData.byPosition.length * 80}px`}}>{analysisData.byPosition.map(d => (<div key={d.name} className="flex items-center gap-2"><span className="w-40 text-sm text-left shrink-0">{d.name}</span><div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-6 relative"><div className="bg-indigo-500 h-6 rounded-full text-white text-xs flex items-center justify-end px-2" style={{ width: `${(d.sum / maxPositionSum) * 100}%` }}><span className="font-sans font-semibold">{toPersianDigits(formatCurrency(d.sum))}</span></div></div></div>))}</div></div>
                </AnalysisSection>

                <AnalysisSection title="گزارش تغییرات ماه به ماه">
                    <div className="mb-4"><label className="text-sm font-medium">فیلتر بر اساس پست:</label><select value={changeReportPositionFilter} onChange={e => setChangeReportPositionFilter(e.target.value)} className="w-full md:w-1/3 p-2 border rounded-md bg-white dark:bg-slate-800 dark:border-slate-600 mt-1"><option value="">همه پست‌ها</option>{[...new Set(analysisData.changes.map(c => c.position))].sort().map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b dark:border-slate-600"><th className="p-2 text-right">پرسنل</th><th className="p-2 text-right">پست</th><th className="p-2">ماه تغییر</th><th className="p-2">کارانه قبلی</th><th className="p-2">کارانه جدید</th><th className="p-2">مبلغ تغییر</th><th className="p-2 text-right">واحد قبلی</th><th className="p-2 text-right">واحد جدید</th></tr></thead><tbody>{paginatedChanges.map((c,i)=><tr key={i} className="border-b dark:border-slate-600 text-center hover:bg-slate-100 dark:hover:bg-slate-600/50"><td className="p-2 text-right font-semibold">{c.person}</td><td className="p-2 text-right">{c.position}</td><td className="p-2">{c.month}</td><td className="p-2 font-sans">{toPersianDigits(formatCurrency(c.prevBonus))}</td><td className="p-2 font-sans">{toPersianDigits(formatCurrency(c.currentBonus))}</td><td className={`p-2 font-sans font-bold ${c.bonusDiff > 0 ? 'text-green-600 dark:text-green-400' : c.bonusDiff < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{c.bonusDiff !== 0 ? (c.bonusDiff > 0 ? '▲ ' : '▼ ') + toPersianDigits(formatCurrency(Math.abs(c.bonusDiff))) : '-'}</td><td className="p-2 text-right">{c.prevDepartment}</td><td className={`p-2 text-right ${c.departmentChanged ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>{c.currentDepartment}</td></tr>)}</tbody></table></div>
                    <PaginationControls currentPage={changeReportPage} totalPages={changeReportTotalPages} onPageChange={setChangeReportPage} />
                </AnalysisSection>
            </div>
             {isDetailModalOpen && <AnalysisDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={modalContent.title} data={modalContent.data} />}
        </div>
    );
};


const AuditLogView = ({ logs, loading }: { logs: BonusEditLog[], loading: boolean }) => {
    return (
        <div className="overflow-x-auto">
            <h3 className="text-xl font-bold mb-4">گزارش تغییرات کارانه</h3>
            {loading && <p>در حال بارگذاری گزارش...</p>}
            {!loading && logs.length === 0 && <p>هیچ تغییری ثبت نشده است.</p>}
            {!loading && logs.length > 0 && (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-600">
                    <thead className="bg-gray-100 dark:bg-slate-700">
                        <tr>
                            {['پرسنل', 'کاربر', 'تاریخ', 'ماه', 'مقدار قبلی', 'مقدار جدید', 'واحد قبلی', 'واحد جدید'].map(h => <th key={h} className="px-3 py-2 text-right text-xs font-bold uppercase">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td className="px-3 py-2 text-sm font-semibold">{log.full_name || toPersianDigits(log.personnel_code)}</td>
                                <td className="px-3 py-2 text-sm">{log.editor_name}</td>
                                <td className="px-3 py-2 text-sm">{toPersianDigits(new Date(log.edit_timestamp).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }))}</td>
                                <td className="px-3 py-2 text-sm">{log.month}</td>
                                <td className="px-3 py-2 text-sm text-red-600 dark:text-red-400 font-sans">{log.old_bonus_value ? toPersianDigits(formatCurrency(log.old_bonus_value)) : '-'}</td>
                                <td className="px-3 py-2 text-sm text-green-600 dark:text-green-400 font-sans">{log.new_bonus_value ? toPersianDigits(formatCurrency(log.new_bonus_value)) : '-'}</td>
                                <td className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{log.old_department || '-'}</td>
                                <td className="px-3 py-2 text-sm text-green-600 dark:text-green-400">{log.new_department || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const AnalysisDetailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    data: { name: string; bonus: number; department: string; position: string; }[];
}> = ({ isOpen, onClose, title, data }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                    <h3 className="text-xl font-semibold">{title} ({toPersianDigits(data.length)} نفر)</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">&times;</button>
                </div>
                <div className="overflow-y-auto p-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b dark:border-slate-600">
                                <th className="p-2 text-right">نام</th>
                                <th className="p-2 text-center">مبلغ کارانه</th>
                                <th className="p-2 text-right">واحد</th>
                                <th className="p-2 text-right">پست</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => (
                                <tr key={index} className="border-b dark:border-slate-700 last:border-b-0 hover:bg-slate-100 dark:hover:bg-slate-700/50">
                                    <td className="p-2 font-semibold">{item.name}</td>
                                    <td className="p-2 text-center font-sans">{toPersianDigits(formatCurrency(item.bonus))}</td>
                                    <td className="p-2">{item.department}</td>
                                    <td className="p-2">{item.position}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t dark:border-slate-700 mt-auto text-left">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-slate-600 rounded-md">بستن</button>
                </div>
            </div>
        </div>
    );
};


export default EnterBonusPage;