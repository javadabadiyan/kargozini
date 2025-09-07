import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { DisciplinaryRecord } from '../../types';
import EditDisciplinaryRecordModal from '../EditDisciplinaryRecordModal';
import { PencilIcon, TrashIcon, DownloadIcon, UploadIcon, DocumentReportIcon } from '../icons/Icons';

declare const XLSX: any;

const HEADER_MAP: { [key: string]: keyof Omit<DisciplinaryRecord, 'id'> } = {
  'نام و نام خانوادگی': 'full_name',
  'کد پرسنلی': 'personnel_code',
  'تاریخ جلسه': 'meeting_date',
  'شرح نامه ارسالی': 'letter_description',
  'رای نهایی کمیته انضباط کار/شورای خسارت': 'final_decision',
};

const TABLE_HEADERS = [...Object.keys(HEADER_MAP), 'عملیات'];
const PAGE_SIZE = 20;

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const DisciplinaryCommitteePage: React.FC = () => {
    const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<DisciplinaryRecord | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    
    const paginatedRecords = React.useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return records.slice(startIndex, startIndex + PAGE_SIZE);
    }, [records, currentPage]);

    const totalPages = Math.ceil(records.length / PAGE_SIZE);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/personnel?type=disciplinary_records');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت اطلاعات');
            }
            const data = await response.json();
            setRecords(data.records || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleDownloadSample = () => {
        const ws = XLSX.utils.aoa_to_sheet([Object.keys(HEADER_MAP)]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
        XLSX.writeFile(wb, 'Sample_Disciplinary_Records.xlsx');
    };
    
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
                const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { raw: false, dateNF: 'yyyy/mm/dd' });
                
                const mappedData = json.map(row => {
                    const newRow: Partial<Omit<DisciplinaryRecord, 'id'>> = {};
                    for (const header in HEADER_MAP) {
                        if (row.hasOwnProperty(header)) {
                            const dbKey = HEADER_MAP[header as keyof typeof HEADER_MAP];
                            newRow[dbKey] = String(row[header] || '');
                        }
                    }
                    return newRow as Omit<DisciplinaryRecord, 'id'>;
                });
                
                const response = await fetch('/api/personnel?type=disciplinary_records', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData),
                });
                
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'خطا در ورود اطلاعات');
                
                setStatus({ type: 'success', message: result.message });
                fetchRecords();

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
        const dataToExport = records.map(r => {
            const row: { [key: string]: any } = {};
            for(const header of Object.keys(HEADER_MAP)){
                const key = HEADER_MAP[header as keyof typeof HEADER_MAP];
                row[header] = toPersianDigits(r[key]);
            }
            return row;
        });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Disciplinary Records');
        XLSX.writeFile(workbook, 'Disciplinary_Records_Export.xlsx');
    };

    const handleEditClick = (record: DisciplinaryRecord) => {
        setEditingRecord(record);
        setIsEditModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setEditingRecord(null);
    };

    const handleSave = async (updatedRecord: DisciplinaryRecord) => {
        setStatus({ type: 'info', message: 'در حال ذخیره تغییرات...' });
        try {
            const response = await fetch('/api/personnel?type=disciplinary_records', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRecord),
            });
            if (!response.ok) throw new Error((await response.json()).error);
            setStatus({ type: 'success', message: 'تغییرات با موفقیت ذخیره شد.' });
            handleCloseModal();
            fetchRecords();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleDelete = async (id: number) => {
        if (window.confirm('آیا از حذف این رکورد اطمینان دارید؟')) {
            setStatus({ type: 'info', message: 'در حال حذف...' });
            try {
                const response = await fetch(`/api/personnel?type=disciplinary_records&id=${id}`, { method: 'DELETE' });
                if (!response.ok) throw new Error((await response.json()).error);
                setStatus({ type: 'success', message: 'رکورد با موفقیت حذف شد.' });
                fetchRecords();
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
        }
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-gray-100 pb-4">
                <h2 className="text-2xl font-bold text-gray-800">کمیته تشویق و انضباطی</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200">
                        <DownloadIcon className="w-4 h-4" /> دانلود نمونه
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-disciplinary" accept=".xlsx, .xls" />
                    <label htmlFor="excel-import-disciplinary" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                        <UploadIcon className="w-4 h-4" /> بازیابی از فایل
                    </label>
                    <button onClick={handleExport} disabled={records.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        <DownloadIcon className="w-4 h-4" /> تهیه پشتیبان
                    </button>
                </div>
            </div>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-100">
                        <tr>
                            {TABLE_HEADERS.map(header => (
                                <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading && <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {error && <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-red-500">{error}</td></tr>}
                        {!loading && !error && paginatedRecords.length > 0 && paginatedRecords.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                                {Object.keys(HEADER_MAP).map(header => {
                                    const key = HEADER_MAP[header as keyof typeof HEADER_MAP];
                                    return <td key={key} className="px-4 py-3 whitespace-pre-wrap text-sm text-gray-700">{toPersianDigits(String(r[key] ?? ''))}</td>;
                                })}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleEditClick(r)} className="p-1 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-100"><PencilIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleDelete(r.id)} className="p-1 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!loading && !error && records.length === 0 && (
                            <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-8 text-gray-500"><DocumentReportIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />هیچ رکوردی یافت نشد.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {!loading && !error && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                    <span className="text-sm text-gray-600">صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                </div>
            )}
            {isEditModalOpen && editingRecord && <EditDisciplinaryRecordModal record={editingRecord} onClose={handleCloseModal} onSave={handleSave} />}
        </div>
    );
};

export default DisciplinaryCommitteePage;