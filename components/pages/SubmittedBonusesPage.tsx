import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BonusData } from '../../types';
import { DocumentReportIcon } from '../icons/Icons';

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 7 }, (_, i) => 1404 + i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    const str = String(s);
    if (typeof s === 'number' && !isNaN(s)) {
        return s.toLocaleString('fa-IR', { useGrouping: false });
    }
    return str.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatCurrency = (value: string | number): string => {
    if (!value && value !== 0) return '';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const SubmittedBonusesPage: React.FC = () => {
    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    const canView = useMemo(() => currentUser.permissions?.submitted_bonuses, [currentUser]);

    const [selectedYear, setSelectedYear] = useState<number>(YEARS[0]);
    const [bonusData, setBonusData] = useState<BonusData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSubmittedBonuses = useCallback(async (year: number) => {
        if (!canView) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/personnel?type=submitted_bonuses&year=${year}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت اطلاعات کارانه ارسال شده');
            }
            const data = await response.json();
            setBonusData(data.bonuses || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setLoading(false);
        }
    }, [canView]);

    useEffect(() => {
        fetchSubmittedBonuses(selectedYear);
    }, [selectedYear, fetchSubmittedBonuses]);
    
    if (!canView) {
        return (
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl flex items-center justify-center h-full">
              <div className="text-center text-slate-600 dark:text-slate-400">
                <h2 className="text-2xl font-bold mb-4">عدم دسترسی</h2>
                <p>شما به این صفحه دسترسی ندارید. لطفاً با مدیر سیستم تماس بگیرید.</p>
              </div>
            </div>
        );
    }

    const headers = ['کد پرسنلی', 'نام و نام خانوادگی', 'پست', 'کاربران ثبت کننده', ...PERSIAN_MONTHS];

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">بایگانی کارانه‌های ارسال شده</h2>
            </div>
            {error && <div className="p-4 mb-4 text-sm rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-700">
                <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">نمایش اطلاعات برای سال:</label>
                <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full md:w-1/3 p-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md">
                    {YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
                </select>
            </div>

             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
                    <thead className="bg-gray-100 dark:bg-slate-700/50">
                        <tr>
                            {headers.map(header => (
                                <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
                        {loading && <tr><td colSpan={17} className="text-center p-4">در حال بارگذاری...</td></tr>}
                        {!loading && !error && bonusData.length === 0 && (
                            <tr><td colSpan={17} className="text-center p-8 text-gray-500 dark:text-gray-400"><DocumentReportIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />هیچ کارانه ارسال شده‌ای برای این سال یافت نشد.</td></tr>
                        )}
                        {!loading && !error && bonusData.map((person) => (
                            <tr key={person.personnel_code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{toPersianDigits(person.personnel_code)}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-800 dark:text-slate-200">{person.first_name} {person.last_name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">{person.position || '---'}</td>
                                <td className="px-4 py-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-slate-300 max-w-xs">{person.submitted_by_user}</td>
                                {PERSIAN_MONTHS.map(month => {
                                    const monthData = person.monthly_data?.[month];
                                    return (
                                        <td key={month} className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-700 dark:text-slate-300">
                                            {monthData ? (
                                                <div>
                                                    <span className="font-sans font-bold text-base">{toPersianDigits(formatCurrency(monthData.bonus))}</span>
                                                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{monthData.department}</span>
                                                </div>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SubmittedBonusesPage;