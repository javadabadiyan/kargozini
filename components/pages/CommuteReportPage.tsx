import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CommuteReportRow, HourlyCommuteReportRow, CommuteEditLog, Personnel } from '../../types';
import { SearchIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import EditHourlyLogModal from '../EditHourlyLogModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

type ReportType = 'general' | 'hourly' | 'edits';

const CommuteReportPage: React.FC = () => {
    const [reportType, setReportType] = useState<ReportType>('general');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', personnelCode: '', department: '' });
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<any | null>(null);

    useEffect(() => {
        const fetchPersonnel = async () => {
            const res = await fetch('/api/personnel?type=personnel&pageSize=100000');
            if (res.ok) {
                const data = await res.json();
                setPersonnelList(data.personnel);
            }
        };
        fetchPersonnel();
    }, []);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('report', reportType);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.personnelCode) params.append('personnelCode', filters.personnelCode);
        if (filters.department) params.append('department', filters.department);

        try {
            const response = await fetch(`/api/commute-logs?${params.toString()}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setData(result.reports || result.logs || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [reportType, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const formatTime = (iso: string | null) => iso ? toPersianDigits(new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '-';
    const formatDate = (iso: string | null) => iso ? toPersianDigits(new Date(iso).toLocaleDateString('fa-IR')) : '-';

    const renderTable = () => {
        if (loading) return <p className="text-center p-4">در حال بارگذاری گزارش...</p>;
        if (data.length === 0) return <p className="text-center p-4">داده‌ای برای نمایش وجود ندارد.</p>;

        switch(reportType) {
            case 'general':
                return (
                    <table className="min-w-full divide-y divide-gray-200">
                        {/* ... general report table ... */}
                    </table>
                );
             case 'hourly':
                return (
                    <table className="min-w-full divide-y divide-gray-200">
                        {/* ... hourly report table ... */}
                    </table>
                );
            case 'edits':
                 return (
                    <table className="min-w-full divide-y divide-gray-200">
                        {/* ... edits report table ... */}
                    </table>
                );
            default: return null;
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">گزارشات تردد</h2>
            <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
                <div className="flex gap-4 items-center">
                    <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="p-2 border rounded-md">
                        <option value="general">گزارش کلی</option>
                        <option value="hourly">گزارش ساعتی</option>
                        <option value="edits">گزارش ویرایش‌ها</option>
                    </select>
                    <button onClick={fetchReport} className="px-4 py-2 bg-blue-600 text-white rounded-md">نمایش گزارش</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="p-2 border rounded-md"/>
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="p-2 border rounded-md"/>
                    <select name="personnelCode" value={filters.personnelCode} onChange={handleFilterChange} className="p-2 border rounded-md">
                        <option value="">همه پرسنل</option>
                        {personnelList.map(p => <option key={p.id} value={p.personnel_code}>{p.first_name} {p.last_name}</option>)}
                    </select>
                    {/* Add department filter if needed */}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
                {renderTable()}
            </div>
        </div>
    );
};

export default CommuteReportPage;
