import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Dependent } from '../../types';
import { SearchIcon, UserPlusIcon, UploadIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import EditDependentModal from '../EditDependentModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const DependentsInfoPage: React.FC = () => {
    const [dependents, setDependents] = useState<Dependent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSize] = useState(15);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDependent, setEditingDependent] = useState<Partial<Dependent> | null>(null);

    const fetchDependents = useCallback(async (page: number, search: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=dependents&page=${page}&pageSize=${pageSize}&searchTerm=${encodeURIComponent(search)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'خطا در دریافت اطلاعات');
            }
            const data = await response.json();
            setDependents(data.dependents || []);
            setTotalCount(data.totalCount || 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    useEffect(() => {
        fetchDependents(currentPage, searchTerm);
    }, [currentPage, searchTerm, fetchDependents]);
    
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        // The useEffect will trigger the fetch
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            // Basic mapping from common Persian headers to English keys
            const keyMap: { [key: string]: keyof Dependent } = {
                'کدپرسنلی': 'personnel_code', 'كدپرسنلي': 'personnel_code', 'کد پرسنلی': 'personnel_code',
                'نام': 'first_name',
                'نام خانوادگی': 'last_name', 'نامخانوادگي': 'last_name',
                'نام پدر': 'father_name',
                'نسبت': 'relation_type',
                'تاريخ تولد': 'birth_date', 'تاریخ تولد': 'birth_date',
                'جنسيت': 'gender', 'جنسیت': 'gender',
                'ماه تولد': 'birth_month',
                'روز تولد': 'birth_day',
                'شماره شناسنامه': 'id_number', 'ش شناسنامه': 'id_number',
                'كد ملي بستگان': 'national_id', 'کد ملی بستگان': 'national_id',
                'كد ملي سرپرست': 'guardian_national_id', 'کد ملی سرپرست': 'guardian_national_id',
                'محل صدور شناسنامه': 'issue_place',
                'نوع': 'insurance_type',
            };

            const mappedData = json.map(row => {
                const newRow: Partial<Dependent> = {};
                for (const key in row) {
                    const mappedKey = keyMap[key.trim()];
                    if (mappedKey) {
                        // @ts-ignore
                        newRow[mappedKey] = String(row[key]);
                    }
                }
                return newRow;
            });
            
            setStatus({ type: 'info', message: `در حال پردازش ${mappedData.length} رکورد...` });

            try {
                const response = await fetch('/api/personnel?type=dependents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error);
                setStatus({ type: 'success', message: result.message });
                fetchDependents(1, '');
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در آپلود فایل' });
            } finally {
                if (event.target) event.target.value = ''; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSave = async (dependent: Partial<Dependent>) => {
        const isNew = !dependent.id;
        const method = isNew ? 'POST' : 'PUT';
        setStatus({ type: 'info', message: 'در حال ذخیره اطلاعات...' });
        try {
            const response = await fetch('/api/personnel?type=dependents', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dependent),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.details || result.error);
            setStatus({ type: 'success', message: result.message });
            setIsModalOpen(false);
            fetchDependents(currentPage, searchTerm);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات' });
        }
    };
    
    const handleDelete = async (id: number) => {
        if (window.confirm('آیا از حذف این رکورد اطمینان دارید؟')) {
            setStatus({ type: 'info', message: 'در حال حذف...' });
            try {
                const response = await fetch(`/api/personnel?type=dependents&id=${id}`, { method: 'DELETE' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error);
                setStatus({ type: 'success', message: result.message });
                fetchDependents(currentPage, searchTerm);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
            }
        }
    };

    const openModalForNew = () => {
        setEditingDependent({});
        setIsModalOpen(true);
    };

    const openModalForEdit = (dependent: Dependent) => {
        setEditingDependent(dependent);
        setIsModalOpen(true);
    };

    const totalPages = Math.ceil(totalCount / pageSize);
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };
    
    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">اطلاعات تکمیلی پرسنل (بستگان)</h2>
            
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <form onSubmit={handleSearch} className="flex-grow">
                     <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="جستجو بر اساس نام، کد ملی، کد پرسنلی..." className="w-full pl-4 pr-10 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"/>
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2"><SearchIcon className="w-5 h-5 text-gray-400" /></button>
                     </div>
                </form>
                <div className="flex items-center gap-2">
                    <button onClick={openModalForNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><UserPlusIcon className="w-5 h-5"/> افزودن دستی</button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                        <UploadIcon className="w-5 h-5"/>
                        ورود از اکسل
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>
                            {['کد پرسنلی', 'نام', 'نام خانوادگی', 'نسبت', 'کد ملی', 'تاریخ تولد', 'عملیات'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading ? <tr><td colSpan={7} className="text-center p-4">در حال بارگذاری...</td></tr> :
                         error ? <tr><td colSpan={7} className="text-center p-4 text-red-500">{error}</td></tr> :
                         dependents.map(d => (
                            <tr key={d.id}>
                                <td className="px-4 py-3 text-sm">{toPersianDigits(d.personnel_code)}</td>
                                <td className="px-4 py-3 text-sm">{d.first_name}</td>
                                <td className="px-4 py-3 text-sm">{d.last_name}</td>
                                <td className="px-4 py-3 text-sm">{d.relation_type}</td>
                                <td className="px-4 py-3 text-sm">{toPersianDigits(d.national_id)}</td>
                                <td className="px-4 py-3 text-sm">{toPersianDigits(d.birth_date)}</td>
                                <td className="px-4 py-3 text-sm">
                                    <button onClick={() => openModalForEdit(d)} className="p-1 text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDelete(d.id)} className="p-1 text-red-600 mr-2"><TrashIcon className="w-5 h-5"/></button>
                                </td>
                            </tr>
                         ))}
                    </tbody>
                </table>
            </div>
            
            <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-700 dark:text-gray-300">نمایش {toPersianDigits(dependents.length)} از {toPersianDigits(totalCount)} رکورد</span>
                <div className="flex gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">قبلی</button>
                    <span className="px-3 py-1 text-sm">{toPersianDigits(currentPage)} / {toPersianDigits(totalPages)}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">بعدی</button>
                </div>
            </div>

            {isModalOpen && <EditDependentModal dependent={editingDependent!} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

export default DependentsInfoPage;
