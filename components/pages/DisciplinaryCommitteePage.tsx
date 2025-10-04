import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { DisciplinaryRecord } from '../../types';
import { PencilIcon, TrashIcon, UserPlusIcon, UploadIcon } from '../icons/Icons';
import EditDisciplinaryRecordModal from '../EditDisciplinaryRecordModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const DisciplinaryCommitteePage: React.FC = () => {
    const [records, setRecords] = useState<DisciplinaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<DisciplinaryRecord | null>(null);

    const fetchRecords = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/personnel?type=disciplinary_records');
            if (!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            setRecords(data.records || []);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleSave = async (record: DisciplinaryRecord) => {
        const isNew = !record.id;
        const method = isNew ? 'POST' : 'PUT';
        setStatus({ type: 'info', message: 'در حال ذخیره...' });
        try {
            const response = await fetch('/api/personnel?type=disciplinary_records', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            setIsModalOpen(false);
            fetchRecords();
        } catch (err) {
             setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('آیا از حذف این رکورد اطمینان دارید؟')) {
            setStatus({ type: 'info', message: 'در حال حذف...' });
            try {
                const response = await fetch(`/api/personnel?type=disciplinary_records&id=${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: data.message });
                fetchRecords();
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
            }
        }
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">صورت جلسات کمیته انضباطی</h2>
            {status && <div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
            <div className="mb-4">
                <button onClick={() => { setEditingRecord({} as DisciplinaryRecord); setIsModalOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">افزودن رکورد جدید</button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    {/* Table headers and body */}
                </table>
            </div>
             {isModalOpen && <EditDisciplinaryRecordModal record={editingRecord!} onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

export default DisciplinaryCommitteePage;
