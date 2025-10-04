import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { PerformanceReview, Personnel } from '../../types';
import { SearchIcon, TrashIcon } from '../icons/Icons';
import PerformanceReviewDetailsModal from '../PerformanceReviewDetailsModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const ArchivePerformanceReviewPage: React.FC = () => {
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [filters, setFilters] = useState({ year: '', department: '', personnel_code: '' });
    
    const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams(filters).toString();
        try {
            const response = await fetch(`/api/personnel?type=performance_reviews&${params}`);
            if (!response.ok) throw new Error((await response.json()).error);
            const data = await response.json();
            setReviews(data.reviews || []);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در دریافت اطلاعات' });
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        const fetchPersonnel = async () => {
            const res = await fetch('/api/personnel?type=personnel&pageSize=100000');
            if(res.ok) setPersonnelList((await res.json()).personnel);
        };
        fetchPersonnel();
        fetchReviews();
    }, [fetchReviews]);
    
    const handleDelete = async (id: number) => {
        if(window.confirm('آیا از حذف این ارزیابی اطمینان دارید؟')) {
            try {
                const res = await fetch(`/api/personnel?type=performance_reviews&id=${id}`, { method: 'DELETE' });
                if(!res.ok) throw new Error((await res.json()).error);
                setStatus({ type: 'success', message: 'ارزیابی حذف شد.' });
                fetchReviews();
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
            }
        }
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">بایگانی ارزیابی‌ها</h2>
            {status && <div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
            {/* Filters UI */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    {/* Table headers and body */}
                    <tbody>
                        {loading ? <tr><td colSpan={6}>Loading...</td></tr> :
                         reviews.map(review => (
                             <tr key={review.id}>
                                <td>{review.full_name}</td>
                                <td>{toPersianDigits(review.personnel_code)}</td>
                                <td>{review.department}</td>
                                <td>{toPersianDigits(review.overall_score)}</td>
                                <td>
                                    <button onClick={() => setSelectedReview(review)}>مشاهده</button>
                                    <button onClick={() => handleDelete(review.id)}><TrashIcon className="w-5 h-5"/></button>
                                </td>
                             </tr>
                         ))
                        }
                    </tbody>
                </table>
            </div>
            {selectedReview && <PerformanceReviewDetailsModal review={selectedReview} onClose={() => setSelectedReview(null)} />}
        </div>
    );
};

export default ArchivePerformanceReviewPage;
