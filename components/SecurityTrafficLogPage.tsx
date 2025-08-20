import React, { useState, useEffect, useCallback } from 'react';
import type { Personnel, SecurityTrafficLogWithDetails } from '../types';
import { toPersianDigits } from './format';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const SHIFTS = ['A', 'B', 'C'];

export const SecurityTrafficLogPage: React.FC<{ personnelList: Personnel[] }> = ({ personnelList }) => {
    const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>('');
    const [selectedShift, setSelectedShift] = useState<string>('A');
    const [todaysLogs, setTodaysLogs] = useState<SecurityTrafficLogWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchTodaysLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`${API_BASE_URL}/api/users?module=security&type=logs&date=${today}`);
            if (!response.ok) throw new Error('Failed to fetch logs');
            const data: SecurityTrafficLogWithDetails[] = await response.json();
            setTodaysLogs(data);
        } catch (err) {
            setError('خطا در بارگذاری تردد های امروز.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTodaysLogs();
    }, [fetchTodaysLogs]);

    const handleLogAction = async (action: 'entry' | 'exit') => {
        if (!selectedPersonnelId || !selectedShift) {
            setError('لطفا پرسنل و شیفت را انتخاب کنید.');
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/users?module=security&type=logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personnel_id: parseInt(selectedPersonnelId, 10),
                    shift: selectedShift,
                    action,
                }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'عملیات ناموفق بود');
            }
            await fetchTodaysLogs(); // Refresh the list
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const selectedPersonnelLog = todaysLogs.find(
        log => log.personnel_id === parseInt(selectedPersonnelId, 10) && log.shift === selectedShift
    );
    
    const canLogIn = !selectedPersonnelLog || !!selectedPersonnelLog.exit_time;
    const canLogOut = selectedPersonnelLog && !selectedPersonnelLog.exit_time;

    return (
        <div className="animate-fade-in-up">
            <h1 className="text-3xl font-bold text-slate-700 mb-6">ثبت تردد</h1>
            <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                    <div>
                        <label htmlFor="personnel" className="block text-sm font-medium text-slate-700 mb-1">پرسنل</label>
                        <select
                            id="personnel"
                            value={selectedPersonnelId}
                            onChange={(e) => setSelectedPersonnelId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">انتخاب کنید...</option>
                            {personnelList.map(p => (
                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="shift" className="block text-sm font-medium text-slate-700 mb-1">شیفت</label>
                        <select
                            id="shift"
                            value={selectedShift}
                            onChange={(e) => setSelectedShift(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2 lg:col-span-2">
                        <button
                            onClick={() => handleLogAction('entry')}
                            disabled={isLoading || !selectedPersonnelId || !canLogIn}
                            className="w-full px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            {isLoading ? '...' : 'ثبت ورود'}
                        </button>
                        <button
                            onClick={() => handleLogAction('exit')}
                            disabled={isLoading || !selectedPersonnelId || !canLogOut}
                            className="w-full px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                           {isLoading ? '...' : 'ثبت خروج'}
                        </button>
                    </div>
                </div>
                 {error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">تردد ثبت شده امروز</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">نام</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">واحد</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">سمت</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">ساعت ورود</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">ساعت خروج</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">شیفت</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500">در حال بارگذاری...</td></tr>
                            ) : todaysLogs.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-slate-500">هیچ ترددی برای امروز ثبت نشده است.</td></tr>
                            ) : (
                                todaysLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{log.first_name} {log.last_name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{log.position}</td>
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