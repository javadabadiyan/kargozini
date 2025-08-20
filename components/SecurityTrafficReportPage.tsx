import React, { useState, useEffect, useMemo } from 'react';
import type { SecurityTrafficLogWithDetails } from '../types';
import { toPersianDigits } from './format';
import { DownloadIcon } from './icons';
import * as XLSX from 'xlsx';

export const SecurityTrafficReportPage: React.FC = () => {
    const [allLogs, setAllLogs] = useState<SecurityTrafficLogWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });

    useEffect(() => {
        const fetchAllLogs = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/users?module=security&type=logs`);
                if (!response.ok) throw new Error('Failed to fetch logs');
                const data: SecurityTrafficLogWithDetails[] = await response.json();
                setAllLogs(data);
            } catch (err) {
                setError('خطا در بارگذاری گزارش تردد.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAllLogs();
    }, []);

    const filteredLogs = useMemo(() => {
        return allLogs.filter(log => {
            // log_date is 'YYYY-MM-DD' string from DB, safe for string comparison
            const matchesDate = 
                (!dateRange.from || log.log_date >= dateRange.from) &&
                (!dateRange.to || log.log_date <= dateRange.to);
            
            const matchesSearch = 
                !searchQuery ||
                `${log.first_name} ${log.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.unit.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesDate && matchesSearch;
        });
    }, [allLogs, searchQuery, dateRange]);
    
    const handleExportExcel = () => {
        const headers = ['نام', 'واحد', 'سمت', 'تاریخ', 'ساعت ورود', 'ساعت خروج', 'شیفت'];
        const data = filteredLogs.map(log => [
            `${log.first_name} ${log.last_name}`,
            log.unit,
            log.position,
            new Date(log.log_date + 'T00:00:00').toLocaleDateString('fa-IR'), // Ensure correct date parsing
            new Date(log.entry_time).toLocaleTimeString('fa-IR'),
            log.exit_time ? new Date(log.exit_time).toLocaleTimeString('fa-IR') : '-',
            log.shift
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Traffic Report');
        XLSX.writeFile(wb, 'گزارش_تردد.xlsx');
    };
    
    return (
        <div className="animate-fade-in-up">
            <div className="no-print">
                <h1 className="text-3xl font-bold text-slate-700 mb-6">گزارش‌گیری تردد</h1>
            </div>
            
            <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8 no-print">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                    <input
                        type="text"
                        placeholder="جستجو نام یا واحد..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <input
                        type="date"
                        value={dateRange.from}
                        onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        title="از تاریخ"
                    />
                    <input
                        type="date"
                        value={dateRange.to}
                        onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        title="تا تاریخ"
                    />
                     <div className="flex gap-2">
                        <button onClick={handleExportExcel} className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                           <DownloadIcon className="w-5 h-5 ml-2"/> اکسل
                        </button>
                         <button onClick={() => window.print()} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            چاپ
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden print-report-container">
                 <h1 className="text-3xl font-bold text-slate-700 my-4 hidden print:block">گزارش تردد پرسنل</h1>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">نام</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">واحد</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">سمت</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">تاریخ</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">ساعت ورود</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">ساعت خروج</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">شیفت</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                           {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-500 no-print">در حال بارگذاری گزارش...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={7} className="text-center py-8 text-red-500">{error}</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-8 text-slate-500">هیچ رکوردی مطابق با فیلترها یافت نشد.</td></tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{log.first_name} {log.last_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.position}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(new Date(log.log_date + 'T00:00:00').toLocaleDateString('fa-IR'))}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(new Date(log.entry_time).toLocaleTimeString('fa-IR'))}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            {log.exit_time ? toPersianDigits(new Date(log.exit_time).toLocaleTimeString('fa-IR')) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.shift}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
