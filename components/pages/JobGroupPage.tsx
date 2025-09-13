import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Personnel } from '../../types';
import EditJobGroupInfoModal from '../EditJobGroupInfoModal';
import { PencilIcon, SearchIcon, TrashIcon, DownloadIcon, UploadIcon, UsersIcon } from '../icons/Icons';

declare const XLSX: any;

const HEADER_MAP: { [key: string]: keyof Personnel } = {
  'کدپرسنلی': 'personnel_code',
  'نام': 'first_name',
  'نام خانوادگی': 'last_name',
  'کد ملی': 'national_id',
  'مدرک تحصیلی': 'education_level',
  'تاریخ استخدام': 'hire_date',
  'ماه استخدام': 'hire_month',
  'سابقه بیمه کلی': 'total_insurance_history',
  'سابقه معدنی': 'mining_history',
  'سابقه غیرمعدنی': 'non_mining_history',
  'گروه شغلی': 'job_group',
  'فاصله گروه از 1404 به بعد': 'group_distance_from_1404',
  'فاصله گروه بعدی': 'next_group_distance',
  'شغل': 'job_title',
  'پست': 'position',
};


const TABLE_HEADERS = Object.keys(HEADER_MAP);
const PAGE_SIZE = 20;

const DEFAULT_RECORD: Partial<Personnel> = {
    personnel_code: '', first_name: '', last_name: '', national_id: '', education_level: '',
    hire_date: '', hire_month: '', total_insurance_history: '', mining_history: '',
    non_mining_history: '', job_group: '', group_distance_from_1404: '', next_group_distance: '',
    job_title: '', position: ''
};

const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const JobGroupPage: React.FC = () => {
    const [records, setRecords] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Partial<Personnel> | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const fetchRecords = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=job_group_info&page=${page}&pageSize=${PAGE_SIZE}&searchTerm=${encodeURIComponent(search)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت اطلاعات');
            }
            const data = await response.json();
            setRecords(data.records || []);
            setTotalPages(Math.ceil((data.totalCount || 0) / PAGE_SIZE));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (currentPage !== 1) setCurrentPage(1);
            else fetchRecords(1, searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm, fetchRecords]);

    useEffect(() => {
        fetchRecords(currentPage, searchTerm);
    }, [currentPage, fetchRecords, searchTerm]);

    const handleOpenAddModal = () => {
        setEditingRecord(DEFAULT_RECORD);
        setIsModalOpen(true);
    };

    const handleEditClick = (record: Personnel) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRecord(null);
    };

    // FIX: Update handleSave to support both single record and bulk (array) record updates from file import.
    const handleSave = async (recordData: Partial<Personnel> | Partial<Personnel>[]) => {
        const isArray = Array.isArray(recordData);
        const isNew = isArray || !(recordData as Partial<Personnel>).id;
        const method = isArray ? 'POST' : (isNew ? 'POST' : 'PUT');
        
        setStatus({ type: 'info', message: 'در حال ذخیره اطلاعات...' });
        try {
            const response = await fetch('/api/personnel?type=job_group_info', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recordData),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.details || data.error || 'خطا در ذخیره اطلاعات');
            setStatus({ type: 'success', message: data.message });
            handleCloseModal();
            fetchRecords(isNew ? 1 : currentPage, searchTerm);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته رخ داد.' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('آیا از حذف این رکورد اطمینان دارید؟ این عمل تمام اطلاعات پرسنل را حذف می‌کند.')) return;
        setStatus({ type: 'info', message: 'در حال حذف...' });
        try {
            const response = await fetch(`/api/personnel?type=job_group_info&id=${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            if (records.length === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1);
            } else {
                fetchRecords(currentPage, searchTerm);
            }
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته رخ داد.' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleDownloadSample = () => {
        const ws = XLSX.utils.aoa_to_sheet([TABLE_HEADERS]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
        XLSX.writeFile(wb, 'Sample_JobGroup_File.xlsx');
    };
    
    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStatus({ type: 'info', message: 'در حال پردازش فایل...' });
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy/mm/dd' });
                const mappedData = json.map((row: any) => {
                    const newRow: Partial<Personnel> = {};
                    for (const header in HEADER_MAP) {
                        if (row.hasOwnProperty(header)) {
                            const dbKey = HEADER_MAP[header as keyof typeof HEADER_MAP];
                            // FIX: Use `as any` to bypass complex type inference issue.
                            (newRow as any)[dbKey] = String(row[header] ?? '');
                        }
                    }
                    return newRow;
                });
                await handleSave(mappedData);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل' });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
                setTimeout(() => setStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExport = () => {
        const dataToExport = records.map(r => {
            const row: { [key: string]: any } = {};
            for(const header of TABLE_HEADERS){
                const key = HEADER_MAP[header as keyof typeof HEADER_MAP];
                row[header] = toPersianDigits(r[key]);
            }
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Job Groups');
        XLSX.writeFile(workbook, 'JobGroup_Export.xlsx');
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">مدیریت گروه شغلی پرسنل</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleOpenAddModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">افزودن دستی</button>
                    <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200"><DownloadIcon className="w-4 h-4"/> دانلود نمونه</button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-jobgroup" accept=".xlsx, .xls" />
                    <label htmlFor="excel-import-jobgroup" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"><UploadIcon className="w-4 h-4"/> ورود از اکسل</label>
                    <button onClick={handleExport} disabled={records.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"><DownloadIcon className="w-4 h-4"/> خروجی اکسل</button>
                </div>
            </div>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`} role="alert">{status.message}</div>}

            <form onSubmit={e => e.preventDefault()} className="mb-6">
                <div className="relative">
                    <input type="text" placeholder="جستجو (نام، کد ملی، کد پرسنلی...)" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700/50 rounded-lg"/>
                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </form>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>{TABLE_HEADERS.map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">{h}</th>)}<th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">عملیات</th></tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading && <tr><td colSpan={TABLE_HEADERS.length + 1} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {error && <tr><td colSpan={TABLE_HEADERS.length + 1} className="text-center p-4 text-red-500">{error}</td></tr>}
                        {!loading && !error && records.length === 0 && (
                            <tr><td colSpan={TABLE_HEADERS.length + 1} className="text-center p-8 text-gray-400"><UsersIcon className="w-12 h-12 mx-auto mb-2" />{searchTerm ? 'موردی یافت نشد.' : 'داده‌ای برای نمایش وجود ندارد.'}</td></tr>
                        )}
                        {!loading && !error && records.map(record => (
                            <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                {/* FIX: Convert record property to string before passing to toPersianDigits to satisfy its type requirement. */}
                                {TABLE_HEADERS.map(header => <td key={header} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{toPersianDigits(String(record[HEADER_MAP[header as keyof typeof HEADER_MAP]] ?? ''))}</td>)}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleEditClick(record)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full"><PencilIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(record.id)} className="p-1 text-red-600 hover:bg-red-100 rounded-full"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {!loading && !error && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                    {/* FIX: Convert numbers to strings before passing to toPersianDigits. */}
                    <span className="text-sm">صفحه {toPersianDigits(String(currentPage))} از {toPersianDigits(String(totalPages))}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                </div>
            )}

            {isModalOpen && <EditJobGroupInfoModal record={editingRecord} onClose={handleCloseModal} onSave={handleSave} />}
        </div>
    );
};

export default JobGroupPage;
