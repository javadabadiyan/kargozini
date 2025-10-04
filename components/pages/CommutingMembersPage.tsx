import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import type { CommutingMember } from '../../types';
import { UserPlusIcon, UploadIcon, TrashIcon } from '../icons/Icons';
import AddCommutingMemberModal from '../AddCommutingMemberModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const CommutingMembersPage: React.FC = () => {
    const [members, setMembers] = useState<CommutingMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/personnel?type=commuting_members');
            if (!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            setMembers(data.members || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'خطا در دریافت لیست');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);
    
    const handleSave = async (member: Omit<CommutingMember, 'id'>) => {
        setStatus({ type: 'info', message: 'در حال افزودن عضو جدید...'});
        try {
            const response = await fetch('/api/personnel?type=commuting_members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(member)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            setIsModalOpen(false);
            fetchMembers();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        } finally {
            setTimeout(() => setStatus(null), 4000);
        }
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

            const mappedData = json.map(row => ({
                full_name: row['نام و نام خانوادگی'],
                personnel_code: String(row['کد پرسنلی']),
                department: row['واحد'],
                position: row['سمت'],
            }));

            setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
            try {
                const response = await fetch('/api/personnel?type=commuting_members', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                setStatus({ type: 'success', message: result.message });
                fetchMembers();
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در آپلود فایل' });
            } finally {
                if(event.target) event.target.value = ''; // Reset input
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">اعضای مجاز تردد</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><UserPlusIcon className="w-5 h-5"/> افزودن</button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                        <UploadIcon className="w-5 h-5"/>
                        ورود از اکسل
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    </label>
                </div>
            </div>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>
                            {['کد پرسنلی', 'نام کامل', 'واحد', 'سمت'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading ? <tr><td colSpan={4} className="text-center p-4">در حال بارگذاری...</td></tr> :
                         error ? <tr><td colSpan={4} className="text-center p-4 text-red-500">{error}</td></tr> :
                         members.map(m => (
                            <tr key={m.id}>
                                <td className="px-4 py-3 text-sm">{toPersianDigits(m.personnel_code)}</td>
                                <td className="px-4 py-3 text-sm">{m.full_name}</td>
                                <td className="px-4 py-3 text-sm">{m.department}</td>
                                <td className="px-4 py-3 text-sm">{m.position}</td>
                            </tr>
                         ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && <AddCommutingMemberModal onClose={() => setIsModalOpen(false)} onSave={handleSave} />}
        </div>
    );
};

export default CommutingMembersPage;
