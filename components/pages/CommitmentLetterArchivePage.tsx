import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SearchIcon, TrashIcon, DocumentReportIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from '../icons/Icons';
import type { CommitmentLetter } from '../../types';
import EditCommitmentLetterModal from '../EditCommitmentLetterModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '۰';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};


const CommitmentLetterArchivePage: React.FC = () => {
    const [letters, setLetters] = useState<CommitmentLetter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [expandedGuarantors, setExpandedGuarantors] = useState<Set<string>>(new Set());

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLetter, setEditingLetter] = useState<CommitmentLetter | null>(null);

    const fetchLetters = useCallback(async (searchQuery = '') => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=commitment_letters&searchTerm=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت بایگانی نامه‌ها');
            }
            const data = await response.json();
            setLetters(data.letters || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLetters();
    }, [fetchLetters]);
    
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLetters(searchTerm);
    };
    
    const handleDeleteLetter = async (id: number) => {
        if (window.confirm('آیا از حذف این نامه از بایگانی اطمینان دارید؟ این عمل قابل بازگشت نیست.')) {
            setStatus({ type: 'info', message: 'در حال حذف نامه...'});
            try {
                const response = await fetch(`/api/personnel?type=commitment_letters&id=${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: 'نامه با موفقیت حذف شد.' });
                fetchLetters(searchTerm);
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف نامه' });
            } finally {
                setTimeout(() => setStatus(null), 4000);
            }
        }
    };

    const handleEditClick = (letter: CommitmentLetter) => {
        setEditingLetter(letter);
        setIsEditModalOpen(true);
    };

    const handleSaveLetter = async (letter: CommitmentLetter) => {
        setStatus({ type: 'info', message: 'در حال ویرایش نامه...' });
        try {
            const response = await fetch('/api/personnel?type=commitment_letters', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(letter)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: 'نامه با موفقیت ویرایش شد.' });
            setIsEditModalOpen(false);
            setEditingLetter(null);
            fetchLetters(searchTerm); // Refresh data
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ویرایش نامه' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const overallSummary = useMemo(() => {
        if (!letters || letters.length === 0) {
            return { count: 0, totalAmount: 0 };
        }
        const totalAmount = letters.reduce((sum, letter) => sum + Number(letter.loan_amount), 0);
        return {
            count: letters.length,
            totalAmount: totalAmount
        };
    }, [letters]);

    const guarantorSummary = useMemo(() => {
        if (!letters || letters.length === 0) return [];
        
        const summary = letters.reduce((acc, letter) => {
            const code = letter.guarantor_personnel_code;
            if (!acc[code]) {
                acc[code] = {
                    guarantor_personnel_code: code,
                    guarantor_name: letter.guarantor_name,
                    letterCount: 0,
                    totalAmount: 0,
                    letters: [],
                };
            }
            acc[code].letterCount += 1;
            acc[code].totalAmount += Number(letter.loan_amount);
            acc[code].letters.push(letter);
            return acc;
        }, {} as Record<string, { guarantor_personnel_code: string; guarantor_name: string; letterCount: number; totalAmount: number; letters: CommitmentLetter[] }>);

        // FIX: Explicitly cast sort callback arguments to any to fix 'property does not exist on type unknown' error.
        return Object.values(summary).sort((a: any, b: any) => b.totalAmount - a.totalAmount);
    }, [letters]);
    
    const toggleGuarantorExpansion = (code: string) => {
        setExpandedGuarantors(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) {
                newSet.delete(code);
            } else {
                newSet.add(code);
            }
            return newSet;
        });
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">بایگانی و خلاصه تعهدات</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-bold text-blue-800">تعداد کل نامه‌ها</h4>
                    <p className="text-2xl font-bold text-blue-900">{toPersianDigits(overallSummary.count)}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-bold text-green-800">جمع مبالغ تعهد شده (ریال)</h4>
                    <p className="text-2xl font-bold text-green-900 font-sans">{toPersianDigits(formatCurrency(overallSummary.totalAmount))}</p>
                </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="mb-6">
                <label htmlFor="search-letters" className="block text-sm font-medium text-gray-700 mb-2">
                    جستجو در بایگانی
                </label>
                <div className="flex">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            id="search-letters"
                            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="نام وام‌گیرنده، ضامن، کد ملی، کد پرسنلی..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-l-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        جستجو
                    </button>
                </div>
            </form>

            <div className="overflow-x-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
                {loading && <p className="text-center py-4">در حال بارگذاری اطلاعات...</p>}
                {error && <p className="text-center py-4 text-red-500">{error}</p>}
                {!loading && !error && letters.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        <DocumentReportIcon className="w-16 h-16 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">
                            {searchTerm ? 'هیچ نامه‌ای مطابق با جستجوی شما یافت نشد.' : 'هیچ نامه‌ای در بایگانی ثبت نشده است.'}
                        </h3>
                    </div>
                )}
                {!loading && !error && guarantorSummary.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {['ضامن', 'کد پرسنلی', 'تعداد تعهدات', 'جمع مبالغ (ریال)', 'جزئیات'].map(h => (
                                    <th key={h} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {guarantorSummary.map(summaryItem => (
                               <React.Fragment key={summaryItem.guarantor_personnel_code}>
                                   <tr className="cursor-pointer hover:bg-slate-100" onClick={() => toggleGuarantorExpansion(summaryItem.guarantor_personnel_code)}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">{summaryItem.guarantor_name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(summaryItem.guarantor_personnel_code)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(summaryItem.letterCount)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-sans font-bold">{toPersianDigits(formatCurrency(summaryItem.totalAmount))}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                            {expandedGuarantors.has(summaryItem.guarantor_personnel_code) ? <ChevronUpIcon className="w-5 h-5 mx-auto" /> : <ChevronDownIcon className="w-5 h-5 mx-auto" />}
                                        </td>
                                   </tr>
                                   {expandedGuarantors.has(summaryItem.guarantor_personnel_code) && (
                                       <tr>
                                           <td colSpan={5} className="p-4 bg-gray-50 border-b-2 border-blue-200">
                                               <h4 className="font-bold mb-2">جزئیات تعهدات {summaryItem.guarantor_name}:</h4>
                                               <div className="overflow-x-auto border rounded-lg">
                                                   <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-200">
                                                            <tr>
                                                                {['وام گیرنده', 'مبلغ وام (ریال)', 'بانک', 'تاریخ صدور', 'عملیات'].map(h => (
                                                                    <th key={h} scope="col" className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {summaryItem.letters.map(letter => (
                                                                <tr key={letter.id}>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-sm"><p className="font-semibold">{letter.recipient_name}</p><p className="text-xs text-gray-500">کد ملی: {toPersianDigits(letter.recipient_national_id)}</p></td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-sans">{toPersianDigits(formatCurrency(letter.loan_amount))}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-sm">{letter.bank_name} - {letter.branch_name}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-sm">{toPersianDigits(new Date(letter.issue_date).toLocaleDateString('fa-IR'))}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                        <button onClick={() => handleEditClick(letter)} className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors" aria-label={`ویرایش نامه ${letter.id}`}>
                                                                            <PencilIcon className="w-5 h-5" />
                                                                        </button>
                                                                        <button onClick={() => handleDeleteLetter(letter.id)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors ml-2" aria-label={`حذف نامه ${letter.id}`}>
                                                                            <TrashIcon className="w-5 h-5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                   </table>
                                               </div>
                                           </td>
                                       </tr>
                                   )}
                               </React.Fragment>
                           ))}
                        </tbody>
                    </table>
                )}
            </div>
             {isEditModalOpen && editingLetter && (
                <EditCommitmentLetterModal
                    letter={editingLetter}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveLetter}
                />
            )}
        </div>
    );
};

export default CommitmentLetterArchivePage;