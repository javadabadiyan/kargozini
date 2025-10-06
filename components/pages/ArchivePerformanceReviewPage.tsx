


import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PerformanceReview } from '../../types';
import { SearchIcon, DocumentReportIcon, DownloadIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import PerformanceReviewDetailsModal from '../PerformanceReviewDetailsModal';

declare const XLSX: any;

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

    const [filters, setFilters] = useState({ year: '', department: '', supervisor: '' });
    const [filterOptions, setFilterOptions] = useState<{ years: string[], departments: string[], supervisors: string[] }>({ years: [], departments: [], supervisors: [] });
    
    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    const isAdmin = useMemo(() => currentUser.permissions?.user_management, [currentUser]);

    const fetchReviews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (filters.year) params.append('year', filters.year);
            if (filters.department) params.append('department', filters.department);
            if (filters.supervisor) params.append('supervisor', filters.supervisor);

            const response = await fetch(`/api/personnel?type=performance_reviews&${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت بایگانی ارزیابی‌ها');
            }
            const data = await response.json();
            const fetchedReviews: PerformanceReview[] = data.reviews || [];
            setReviews(fetchedReviews);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    // Fetch initial data and options
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/personnel?type=performance_reviews');
                if (!response.ok) throw new Error('Failed to fetch initial data');
                const data = await response.json();
                const allReviews: PerformanceReview[] = data.reviews || [];
                setReviews(allReviews);
                
                const uniqueYears = [...new Set(allReviews.map(r => r.review_period_start.split('/')[0]).filter(Boolean))].sort((a: string, b: string) => b.localeCompare(a));
                const uniqueDepartments = [...new Set(allReviews.map(r => r.department).filter(Boolean))].sort((a: string, b: string) => a.localeCompare(b, 'fa'));
                const uniqueSupervisors = [...new Set(allReviews.map(r => r.reviewer_name_and_signature).filter(Boolean))].sort((a: string, b: string) => a.localeCompare(b, 'fa'));
                setFilterOptions({ years: uniqueYears, departments: uniqueDepartments, supervisors: uniqueSupervisors });
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleFilterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchReviews();
        setCurrentPage(1);
    };

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

    const departmentStats = useMemo(() => {
        return filteredReviews.reduce((acc: Record<string, number>, review: PerformanceReview) => {
            const dept = review.department || 'نامشخص';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [filteredReviews]);

    const handleExport = () => {
        const dataToExport = filteredReviews.map(r => ({
            'نام پرسنل': r.full_name,
            'کد پرسنلی': r.personnel_code,
            'واحد': r.department,
            'دوره ارزیابی': `${r.review_period_start} تا ${r.review_period_end}`,
            'امتیاز عملکردی': r.total_score_functional,
            'امتیاز رفتاری': r.total_score_behavioral,
            'امتیاز اخلاقی': r.total_score_ethical,
            'امتیاز کل': r.overall_score,
            'تکمیل کننده': r.submitted_by_user,
            'ارزیابی کننده': r.reviewer_name_and_signature,
            'تاریخ ثبت': new Date(r.review_date).toLocaleDateString('fa-IR'),
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Performance Reviews');
        XLSX.writeFile(workbook, `Performance_Reviews_Export.xlsx`);
    };
    
    const handleDelete = async (id: number) => {
        if (!isAdmin) return;
        if (window.confirm('آیا از حذف این ارزیابی اطمینان دارید؟')) {
            try {
                const response = await fetch(`/api/personnel?type=performance_reviews&id=${id}`, { method: 'DELETE' });
                // FIX: Argument of type 'unknown' is not assignable to parameter of type 'string | number'.
                // Handle response from response.json() safely by parsing it and extracting the error message.
                if (!response.ok) {
                    const errorData: any = await response.json();
                    throw new Error(errorData.error || 'خطا در حذف');
                }
                fetchReviews(); // Refetch after delete
            } catch (err) {
                 setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
            }
        }
    };


    return (
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-xl shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <DocumentReportIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">بایگانی ارزیابی عملکرد کارکنان</h2>
            </div>
            {error && <div className="p-4 text-sm rounded-lg bg-red-100 text-red-800">{error}</div>}

            <form onSubmit={handleFilterSubmit} className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select name="year" value={filters.year} onChange={handleFilterChange} className="p-2 border rounded-md"><option value="">همه سال‌ها</option>{filterOptions.years.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
                    <select name="department" value={filters.department} onChange={handleFilterChange} className="p-2 border rounded-md"><option value="">همه واحدها</option>{filterOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                    <select name="supervisor" value={filters.supervisor} onChange={handleFilterChange} className="p-2 border rounded-md"><option value="">همه سرپرستان</option>{filterOptions.supervisors.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">اعمال فیلتر</button>
                </div>
                <div className="relative">
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-1/2 pr-10 pl-4 py-2 border rounded-lg" placeholder="جستجوی سریع در نتایج..."/>
                    <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
            </form>

            <div className="flex flex-wrap gap-4">
                {Object.entries(departmentStats).map(([dept, count]) => (
                    <div key={dept} className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{dept}: </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{toPersianDigits(count)}</span>
                    </div>
                ))}
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نام پرسنل</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">کد پرسنلی</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">دوره ارزیابی</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">امتیاز کل</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">تکمیل کننده فرم</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">تاریخ ثبت</th>
                            {isAdmin && <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading ? <tr><td colSpan={isAdmin ? 7 : 6} className="text-center p-4">در حال بارگذاری...</td></tr> :
                         paginatedReviews.length === 0 ? <tr><td colSpan={isAdmin ? 7 : 6} className="text-center p-8 text-gray-500">موردی یافت نشد.</td></tr> :
                         paginatedReviews.map(review => (
                             <tr key={review.id} onClick={() => setSelectedReview(review)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                                 <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">{review.full_name}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(review.personnel_code)}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(review.review_period_start)} تا {toPersianDigits(review.review_period_end)}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold">{toPersianDigits(review.overall_score)}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{review.submitted_by_user || '-'}</td>
                                 <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(review.review_date).toLocaleDateString('fa-IR'))}</td>
                                 {isAdmin && (
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center" onClick={(e) => e.stopPropagation()}>
                                        <button title="ویرایش (غیرفعال)" className="p-1 text-gray-400 cursor-not-allowed" disabled><PencilIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleDelete(review.id)} className="p-1 text-red-600 hover:text-red-800 mr-2" title="حذف"><TrashIcon className="w-5 h-5"/></button>
                                    </td>
                                 )}
                             </tr>
                         ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-between items-center">
                <button onClick={handleExport} disabled={filteredReviews.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                    <DownloadIcon className="w-5 h-5" /> خروجی اکسل
                </button>
                {!loading && !error && totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-4">
                        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                        <span className="text-sm">صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                    </div>
                )}
            </div>

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