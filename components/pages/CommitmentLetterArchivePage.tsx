import React, { useState, useEffect, useCallback } from 'react';
import { SearchIcon, TrashIcon, DocumentReportIcon } from '../icons/Icons';

interface CommitmentLetter {
    id: number;
    recipient_name: string;
    recipient_national_id: string;
    guarantor_name: string;
    guarantor_personnel_code: string;
    loan_amount: string;
    bank_name: string;
    branch_name: string;
    issue_date: string;
}

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
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">بایگانی نامه‌های تعهد</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

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
                {!loading && !error && letters.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {['وام گیرنده', 'ضامن', 'مبلغ وام (ریال)', 'بانک', 'تاریخ صدور', 'عملیات'].map(h => (
                                    <th key={h} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {letters.map(letter => (
                               <tr key={letter.id}>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm"><p className="font-semibold">{letter.recipient_name}</p><p className="text-xs text-gray-500">کد ملی: {toPersianDigits(letter.recipient_national_id)}</p></td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm"><p className="font-semibold">{letter.guarantor_name}</p><p className="text-xs text-gray-500">کد پرسنلی: {toPersianDigits(letter.guarantor_personnel_code)}</p></td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">{toPersianDigits(formatCurrency(letter.loan_amount))}</td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm">{letter.bank_name} - {letter.branch_name}</td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(letter.issue_date).toLocaleDateString('fa-IR'))}</td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                       <button onClick={() => handleDeleteLetter(letter.id)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors" aria-label={`حذف نامه ${letter.id}`}>
                                           <TrashIcon className="w-5 h-5" />
                                       </button>
                                   </td>
                               </tr>
                           ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default CommitmentLetterArchivePage;