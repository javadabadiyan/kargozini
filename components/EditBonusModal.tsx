import React, { useState, useEffect } from 'react';
import type { BonusData } from '../types';

interface EditBonusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number, month: string, bonus_value: number, department: string) => Promise<void>;
    person: BonusData;
    month: string;
}

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

const EditBonusModal: React.FC<EditBonusModalProps> = ({ isOpen, onClose, onSave, person, month }) => {
    const [department, setDepartment] = useState('');
    const [bonusAmount, setBonusAmount] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (person && month && person.monthly_data?.[month]) {
            const data = person.monthly_data[month];
            setDepartment(data.department);
            setBonusAmount(String(data.bonus));
        }
    }, [person, month]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const bonusValue = Number(toEnglishDigits(bonusAmount).replace(/,/g, ''));
        await onSave(person.id, month, bonusValue, department);
        setIsSaving(false);
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = toEnglishDigits(e.target.value).replace(/,/g, '');
        if (/^\d*$/.test(val)) {
            setBonusAmount(val);
        }
    };
    
    const inputClass = "w-full p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                    <h3 className="text-xl font-semibold">ویرایش کارانه ماه {month} برای {person.first_name} {person.last_name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">واحد</label>
                            <input value={department} onChange={e => setDepartment(e.target.value)} className={inputClass} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">مبلغ کارانه (ریال)</label>
                            <input value={toPersianDigits(formatCurrency(bonusAmount))} onChange={handleAmountChange} className={`${inputClass} font-sans text-left`} required />
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

export default EditBonusModal;
