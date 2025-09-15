import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PerformanceReview } from '../../types';
import { SearchIcon, DocumentReportIcon } from '../icons/Icons';
import PerformanceReviewDetailsModal from '../PerformanceReviewDetailsModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const PAGE_SIZE = 20;

const ArchivePerformanceReviewPage: React.FC = () => {
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/personnel?type=performance_reviews');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت بایگانی ارزیابی‌ها');
            }
            const data = await response.json();
            setReviews(data.reviews || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);
    
    const filteredReviews = useMemo(() => {
        if (!searchTerm) return reviews;
        const lowercasedTerm = searchTerm.toLowerCase().trim();
        return reviews.filter(r =>
            r.full_name?.toLowerCase().includes(lowercasedTerm) ||
            r.personnel_code.toLowerCase().includes(lowercasedTerm)
        );
    }, [reviews, searchTerm]);

    const paginatedReviews = useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return filteredReviews.slice(startIndex, startIndex + PAGE_SIZE);
    }, [filteredReviews, currentPage]);

    const totalPages = Math.ceil(filteredReviews.length / PAGE_SIZE);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    return (
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-xl shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <DocumentReportIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">بایگانی ارزیابی عملکرد کارکنان</h2>
            </div>
            {error && <div className="p-4 text-sm rounded-lg bg-red-100 text-red-800">{error}</div>}
            
            <div className="mb-4">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full md:w-1/2 pr-10 pl-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="جستجو در نام یا کد پرسنلی..."
                    />
                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نام پرسنل</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">کد پرسنلی</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">دوره ارزیابی</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">امتیاز کل</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">تاریخ ثبت</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading ? <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr> :
                         paginatedReviews.length === 0 ? <tr><td colSpan={5} className="text-center p-8 text-gray-500">موردی یافت نشد.</td></tr> :
                         paginatedReviews.map(review => (
                             <tr key={review.id} onClick={() => setSelectedReview(review)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">{review.full_name}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(review.personnel_code)}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(review.review_period_start)} تا {toPersianDigits(review.review_period_end)}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold">{toPersianDigits(review.overall_score)}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(review.review_date).toLocaleDateString('fa-IR'))}</td>
                             </tr>
                         ))}
                    </tbody>
                </table>
            </div>
            
            {!loading && !error && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-4">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                    <span className="text-sm">صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                </div>
            )}

            {selectedReview && (
                <PerformanceReviewDetailsModal 
                    review={selectedReview}
                    onClose={() => setSelectedReview(null)}
                />
            )}
        </div>
    );
};

export default ArchivePerformanceReviewPage;
