import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CommutingMember, CommuteLog, PresentMember } from '../../types';
import { SearchIcon, LoginIcon, LogoutIcon, ClockIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import HourlyCommuteModal from '../HourlyCommuteModal';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const jalaliDateFormatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Tehran'
});

const LogCommutePage: React.FC = () => {
    const [members, setMembers] = useState<CommutingMember[]>([]);
    const [dailyLogs, setDailyLogs] = useState<CommuteLog[]>([]);
    const [presentMembers, setPresentMembers] = useState<PresentMember[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState({ members: true, logs: true, present: true });
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHourlyModalOpen, setIsHourlyModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<CommuteLog | null>(null);

    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);
    const guardName = currentUser.full_name || currentUser.username;

    const todayJalali = useMemo(() => jalaliDateFormatter.format(new Date()), []);
    const todayGregorianForAPI = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), []);

    const fetchAllData = useCallback(async () => {
        setLoading({ members: true, logs: true, present: true });
        try {
            const [membersRes, logsRes, presentRes] = await Promise.all([
                fetch('/api/personnel?type=commuting_members'),
                fetch(`/api/commute-logs?date=${todayGregorianForAPI}`),
                fetch(`/api/commute-logs?report=present&date=${todayGregorianForAPI}`)
            ]);
            if (!membersRes.ok || !logsRes.ok || !presentRes.ok) throw new Error('خطا در دریافت اطلاعات اولیه');
            const membersData = await membersRes.json();
            const logsData = await logsRes.json();
            const presentData = await presentRes.json();
            setMembers(membersData.members || []);
            setDailyLogs(logsData.logs || []);
            setPresentMembers(presentData.present || []);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
            setLoading({ members: false, logs: false, present: false });
        }
    }, [todayGregorianForAPI]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const filteredMembers = useMemo(() => {
        if (!searchTerm) return [];
        const lowerSearch = searchTerm.toLowerCase();
        return members.filter(m => 
            m.full_name.toLowerCase().includes(lowerSearch) || 
            m.personnel_code.includes(lowerSearch)
        ).slice(0, 10);
    }, [members, searchTerm]);

    const handleLogAction = async (personnelCode: string, action: 'entry' | 'exit') => {
        setStatus({ type: 'info', message: 'در حال ثبت تردد...'});
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelCode, guardName, action })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            setSearchTerm('');
            fetchAllData();
        } catch(err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت تردد'});
        }
    };

    const handleSaveEdit = async (updatedLog: CommuteLog) => {
        setStatus({ type: 'info', message: 'در حال ویرایش تردد...'});
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLog)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            setIsEditModalOpen(false);
            fetchAllData();
        } catch (err) {
             setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ویرایش تردد'});
        }
    };

    const openEditModal = (log: CommuteLog) => {
        setSelectedLog(log);
        setIsEditModalOpen(true);
    };
    
    const openHourlyModal = (log: CommuteLog) => {
        setSelectedLog(log);
        setIsHourlyModalOpen(true);
    };

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '-';
        return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran'}));
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">ثبت تردد روزانه - {todayJalali}</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-md">
                    <h3 className="font-bold mb-2">جستجو و ثبت تردد</h3>
                    <div className="relative">
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="جستجوی نام یا کد پرسنلی..." className="w-full pr-10 pl-4 py-2 border rounded-md"/>
                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    {loading.members && <p className="text-center p-4">...</p>}
                    {searchTerm && filteredMembers.length > 0 && (
                        <ul className="mt-2 border rounded-md bg-white max-h-60 overflow-y-auto">
                            {filteredMembers.map(m => (
                                <li key={m.id} className="p-2 flex justify-between items-center hover:bg-gray-100">
                                    <span>{m.full_name} ({toPersianDigits(m.personnel_code)})</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleLogAction(m.personnel_code, 'entry')} className="p-2 bg-green-100 text-green-700 rounded-full hover:bg-green-200"><LoginIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleLogAction(m.personnel_code, 'exit')} className="p-2 bg-red-100 text-red-700 rounded-full hover:bg-red-200"><LogoutIcon className="w-5 h-5"/></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-md">
                     <h3 className="font-bold mb-2">حاضرین امروز ({toPersianDigits(presentMembers.length)})</h3>
                     <div className="max-h-72 overflow-y-auto">
                        {loading.present ? <p>...</p> :
                            <ul className="space-y-2">
                                {presentMembers.map(p => (
                                    <li key={p.log_id} className="p-2 flex justify-between items-center bg-green-50 rounded-md">
                                        <div>
                                            <p className="font-semibold">{p.full_name}</p>
                                            <p className="text-xs text-gray-500">ساعت ورود: {formatTime(p.entry_time)}</p>
                                        </div>
                                        <button onClick={() => handleLogAction(p.personnel_code, 'exit')} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg">ثبت خروج</button>
                                    </li>
                                ))}
                            </ul>
                        }
                     </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-bold mb-2">ترددهای ثبت شده امروز</h3>
                <div className="overflow-x-auto max-h-[50vh]">
                     <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                             <tr>
                                {['نام کامل', 'کد پرسنلی', 'ساعت ورود', 'ساعت خروج', 'نگهبان', 'عملیات'].map(h => <th key={h} className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {loading.logs ? <tr><td colSpan={6} className="text-center p-4">...</td></tr> :
                           dailyLogs.map(log => (
                               <tr key={log.id}>
                                   <td className="px-4 py-2">{log.full_name}</td>
                                   <td className="px-4 py-2">{toPersianDigits(log.personnel_code)}</td>
                                   <td className="px-4 py-2">{formatTime(log.entry_time)}</td>
                                   <td className="px-4 py-2">{formatTime(log.exit_time)}</td>
                                   <td className="px-4 py-2">{log.guard_name}</td>
                                   <td className="px-4 py-2 flex items-center gap-2">
                                       <button onClick={() => openEditModal(log)} className="text-blue-600">ویرایش</button>
                                       <button onClick={() => openHourlyModal(log)} className="flex items-center gap-1 text-sm text-purple-600"><ClockIcon className="w-4 h-4"/> ساعتی</button>
                                   </td>
                               </tr>
                           ))}
                        </tbody>
                     </table>
                </div>
            </div>
            
            {isEditModalOpen && selectedLog && <EditCommuteLogModal log={selectedLog} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveEdit} />}
            {isHourlyModalOpen && selectedLog && <HourlyCommuteModal log={selectedLog} guardName={guardName} date={{ year: '1403', month: '5', day: '1' }} onClose={() => setIsHourlyModalOpen(false)} />}
        </div>
    );
};

export default LogCommutePage;
