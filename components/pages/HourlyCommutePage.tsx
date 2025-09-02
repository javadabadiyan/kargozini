import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CommutingMember, HourlyCommuteLog } from '../../types';
import { SearchIcon, TrashIcon } from '../icons/Icons';

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی',
];

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatTime = (isoString: string | null) => {
    if (!isoString) return '---';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
};

const calculateDuration = (start: string, end: string | null): string => {
    if (!end) return '---';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 0) return 'نامعتبر';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(remMinutes)} دقیقه`;
};

const getTodayTehranDateString = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
};

const HourlyCommutePage: React.FC = () => {
    const [members, setMembers] = useState<CommutingMember[]>([]);
    const [activeLogs, setActiveLogs] = useState<HourlyCommuteLog[]>([]);
    const [completedLogs, setCompletedLogs] = useState<HourlyCommuteLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    // Form state
    const [selectedGuard, setSelectedGuard] = useState(GUARDS[0]);
    const [selectedMember, setSelectedMember] = useState<CommutingMember | null>(null);
    const [reason, setReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    
    const displayStatus = (type: 'info' | 'success' | 'error', message: string) => {
        setStatus({ type, message });
        setTimeout(() => setStatus(null), 5000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [membersRes, activeLogsRes, completedLogsRes] = await Promise.all([
                fetch('/api/commuting-members'),
                fetch('/api/hourly-commute?status=active'),
                fetch(`/api/hourly-commute?date=${getTodayTehranDateString()}`)
            ]);

            if (!membersRes.ok || !activeLogsRes.ok || !completedLogsRes.ok) {
                throw new Error('خطا در دریافت اطلاعات اولیه');
            }

            const membersData = await membersRes.json();
            const activeLogsData = await activeLogsRes.json();
            const completedLogsData = await completedLogsRes.json();

            setMembers(membersData.members || []);
            setActiveLogs(activeLogsData.logs || []);
            setCompletedLogs(completedLogsData.logs || []);

        } catch (err) {
            displayStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredMembers = useMemo(() => {
        if (!searchTerm) return [];
        return members.filter(m => 
            m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.personnel_code.includes(searchTerm)
        ).slice(0, 5); // Limit results for performance
    }, [searchTerm, members]);
    
    const handleLogExit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMember) {
            displayStatus('error', 'لطفاً یک پرسنل را انتخاب کنید.');
            return;
        }

        try {
            const response = await fetch('/api/hourly-commute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personnel_code: selectedMember.personnel_code,
                    full_name: selectedMember.full_name,
                    reason,
                    guard_name: selectedGuard
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            
            displayStatus('success', data.message);
            setSearchTerm('');
            setSelectedMember(null);
            setReason('');
            fetchData();
        } catch(err) {
            displayStatus('error', err instanceof Error ? err.message : 'خطا در ثبت خروج');
        }
    };

    const handleLogReturn = async (id: number) => {
        try {
            const response = await fetch('/api/hourly-commute', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            displayStatus('success', data.message);
            fetchData();
        } catch (err) {
            displayStatus('error', err instanceof Error ? err.message : 'خطا در ثبت بازگشت');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('آیا از حذف این رکورد اطمینان دارید؟')) return;
        try {
            const response = await fetch('/api/hourly-commute', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
             const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            displayStatus('success', data.message);
            fetchData();
        } catch (err) {
            displayStatus('error', err instanceof Error ? err.message : 'خطا در حذف رکورد');
        }
    }

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">ثبت و مدیریت تردد ساعتی</h1>
            {status && <div className={`p-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Form and Active Logs */}
                <div className="lg:col-span-5 space-y-6">
                    <form onSubmit={handleLogExit} className="bg-white p-6 rounded-lg shadow-lg space-y-4">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-2">ثبت خروج ساعتی جدید</h2>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">نگهبان شیفت</label>
                             <select value={selectedGuard} onChange={e => setSelectedGuard(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50">
                                {GUARDS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="relative">
                            <label htmlFor="search-personnel" className="block text-sm font-medium text-gray-700 mb-1">انتخاب پرسنل</label>
                            <input
                                id="search-personnel"
                                type="text"
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setSelectedMember(null); }}
                                placeholder="جستجوی نام یا کد پرسنلی..."
                                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            />
                            <SearchIcon className="absolute right-3 top-10 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                             {filteredMembers.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto">
                                    {filteredMembers.map(m => (
                                        <li key={m.personnel_code} onClick={() => { setSelectedMember(m); setSearchTerm(`${m.full_name} (${m.personnel_code})`); }} className="p-2 hover:bg-gray-100 cursor-pointer">{m.full_name}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">دلیل / مقصد</label>
                            <textarea id="reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded-md" placeholder="مثال: مراجعه به دکتر، امور بانکی..."></textarea>
                        </div>
                        <button type="submit" disabled={!selectedMember} className="w-full py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">ثبت خروج</button>
                    </form>

                     <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">لیست خروج فعال ({toPersianDigits(activeLogs.length)})</h2>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                           {loading ? <p>در حال بارگذاری...</p> : activeLogs.length === 0 ? <p className="text-gray-500 text-center">هیچ خروج فعالی ثبت نشده است.</p> :
                            activeLogs.map(log => (
                                <div key={log.id} className="p-3 border rounded-lg bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                        <p className="font-semibold">{log.full_name}</p>
                                        <p className="text-sm text-gray-600">علت: {log.reason || 'ثبت نشده'}</p>
                                        <p className="text-xs text-gray-500">خروج در ساعت: {formatTime(log.exit_time)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleLogReturn(log.id)} className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">ثبت بازگشت</button>
                                        <button onClick={() => handleDelete(log.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full" title="حذف"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Completed Logs */}
                <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-2 mb-4">ترددهای ساعتی تکمیل شده امروز</h2>
                    <div className="overflow-x-auto max-h-[80vh]">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">پرسنل</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">خروج</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">بازگشت</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">مدت زمان</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr> :
                                 completedLogs.length === 0 ? <tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ تردد تکمیل شده‌ای امروز ثبت نشده است.</td></tr> :
                                 completedLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-medium">{log.full_name}</div><div className="text-xs text-gray-500">{log.reason || '-'}</div></td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{formatTime(log.exit_time)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{formatTime(log.return_time)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm">{calculateDuration(log.exit_time, log.return_time)}</td>
                                        <td className="px-4 py-3 text-center"><button onClick={() => handleDelete(log.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-full" title="حذف"><TrashIcon className="w-4 h-4" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HourlyCommutePage;
