import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { Personnel } from '../../types';
import { SearchIcon, UserPlusIcon, UploadIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import EditJobGroupInfoModal from '../EditJobGroupInfoModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const JobGroupPage: React.FC = () => {
    const [records, setRecords] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 15;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Partial<Personnel> | null>(null);

    const fetchRecords = useCallback(async (page: number, search: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/personnel?type=job_group_info&page=${page}&pageSize=${pageSize}&searchTerm=${encodeURIComponent(search)}`);
            if (!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            setRecords(data.records || []);
            setTotalCount(data.totalCount || 0);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    useEffect(() => {
        fetchRecords(currentPage, searchTerm);
    }, [currentPage, searchTerm, fetchRecords]);

    const handleSave = async (record: Partial<Personnel>) => {
        const isNew = !record.id;
        const method = isNew ? 'POST' : 'PUT';
        setStatus({ type: 'info', message: 'در حال ذخیره...' });
        try {
            const response = await fetch('/api/personnel?type=job_group_info', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            setIsModalOpen(false);
            fetchRecords(1, '');
        } catch(err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        }
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">اطلاعات گروه شغلی</h2>
            {status && <div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
             <div className="mb-4 flex justify-between">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="جستجو..." className="p-2 border rounded-md"/>
                <button onClick={() => { setEditingRecord({}); setIsModalOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">افزودن دستی</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    {/* Table headers and body */}
                </table>
            </div>
            {isModalOpen && <EditJobGroupInfoModal record={editingRecord} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

export default JobGroupPage;
