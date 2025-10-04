import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { BonusData, Personnel } from '../../types';
import { UploadIcon, TrashIcon, PencilIcon } from '../icons/Icons';
import EditBonusModal from '../EditBonusModal';

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 5 }, (_, i) => 1403 + i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const EnterBonusPage: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState(YEARS[0]);
    const [selectedMonth, setSelectedMonth] = useState(PERSIAN_MONTHS[0]);
    const [bonusData, setBonusData] = useState<BonusData[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [editingBonus, setEditingBonus] = useState<{person: BonusData, month: string} | null>(null);

    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    
    const fetchBonusData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/personnel?type=bonuses&year=${selectedYear}&user=${currentUser.username}`);
            if(!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            setBonusData(data.bonuses || []);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, [selectedYear, currentUser.username]);

    useEffect(() => {
        fetchBonusData();
    }, [fetchBonusData]);
    
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        // Logic to read excel and call API
    };
    
    const handleFinalize = async () => {
        if(window.confirm(`آیا از ارسال نهایی کارانه سال ${selectedYear} اطمینان دارید؟ پس از ارسال، امکان ویرایش وجود نخواهد داشت.`)) {
            setStatus({ type: 'info', message: 'در حال ارسال نهایی...'});
            try {
                const res = await fetch('/api/personnel?type=finalize_bonuses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ year: selectedYear, user: currentUser.username })
                });
                if(!res.ok) throw new Error((await res.json()).error);
                setStatus({ type: 'success', message: 'ارسال نهایی با موفقیت انجام شد.' });
                fetchBonusData();
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ارسال نهایی' });
            }
        }
    };
    
    const handleSaveEdit = async (id: number, month: string, bonus_value: number, department: string) => {
        // save logic
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">ارسال کارانه ماهانه</h2>
            {status && <div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-3 gap-4 mb-4">
                {/* Year and month selectors */}
            </div>
            
            <div className="flex justify-between items-center mb-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer">
                    <UploadIcon className="w-5 h-5"/>
                    ورود از اکسل برای ماه {selectedMonth}
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
                 <button onClick={handleFinalize} className="px-4 py-2 bg-red-600 text-white rounded-lg">ارسال نهایی سال {toPersianDigits(selectedYear)}</button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    {/* Table headers and body */}
                </table>
            </div>

            {editingBonus && <EditBonusModal isOpen={!!editingBonus} onClose={() => setEditingBonus(null)} onSave={handleSaveEdit} person={editingBonus.person} month={editingBonus.month} />}
        </div>
    );
};

export default EnterBonusPage;
