import React, { useState, useEffect, useCallback } from 'react';
import type { CommuteLog } from '../types';

interface MidDayLeaveModalProps {
  personLog: CommuteLog;
  viewDate: { year: string; month: string; day: string; };
  guardName: string;
  onClose: () => void;
  onUpdate: () => void;
}

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return '---';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
};

const jalaliToGregorian = (jy: number, jm: number, jd: number): [number, number, number] => {
    let sal_a, gy, gm, gd, j_day_no;
    sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    gy = jy + 621;
    let leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
    if (leap) sal_a[2] = 29;
    if (jm <= 6) {
        j_day_no = (jm - 1) * 31 + jd;
    } else {
        j_day_no = 186 + (jm - 7) * 30 + jd;
    }
    if (leap && j_day_no > 59) j_day_no++;
    if (j_day_no > 79) j_day_no -= 79;
    else {
        gy--;
        j_day_no += 286;
        leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
        if (leap) j_day_no++;
    }
    for (gm = 1; gm < 13; gm++) {
        if (j_day_no <= sal_a[gm]) break;
        j_day_no -= sal_a[gm];
    }
    gd = j_day_no;
    return [gy, gm, gd];
};


const MidDayLeaveModal: React.FC<MidDayLeaveModalProps> = ({ personLog, viewDate, guardName, onClose, onUpdate }) => {
    const [logs, setLogs] = useState<CommuteLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const personStatus: 'present' | 'absent' = !logs.length || logs[logs.length-1]?.exit_time ? 'absent' : 'present';

    const fetchPersonLogs = useCallback(async () => {
        if (!viewDate.year || !viewDate.month || !viewDate.day) return;
        setLoading(true);
        setError(null);
        try {
            const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(viewDate.year), parseInt(viewDate.month), parseInt(viewDate.day));
            const dateString = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
            const response = await fetch(`/api/commute-logs?date=${dateString}&personnel_code=${personLog.personnel_code}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'خطا در دریافت ترددها');
            }
            const data = await response.json();
            setLogs(data.logs || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setLoading(false);
        }
    }, [viewDate, personLog.personnel_code]);

    useEffect(() => {
        fetchPersonLogs();
    }, [fetchPersonLogs]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const action = personStatus === 'present' ? 'exit' : 'entry';
        
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personnelCode: personLog.personnel_code,
                    guardName,
                    action,
                    description: action === 'exit' ? description : undefined,
                })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `خطا در ثبت ${action === 'entry' ? 'ورود' : 'خروج'}`);
            }
            onUpdate();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-semibold text-gray-800">ثبت تردد بین ساعتی برای: {personLog.full_name}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto">
                    {error && <div className="p-3 mb-4 text-sm rounded-lg bg-red-100 text-red-800">{error}</div>}
                    
                    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                        <h4 className="font-bold mb-2">افزودن تردد جدید</h4>
                         <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200 rounded-lg mb-4">
                            <div className={`text-center px-4 py-2 text-sm font-semibold rounded-md ${personStatus === 'absent' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                                ثبت ورود
                            </div>
                            <div className={`text-center px-4 py-2 text-sm font-semibold rounded-md ${personStatus === 'present' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                                ثبت خروج
                            </div>
                        </div>

                        {personStatus === 'present' && (
                             <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">شرح (مثال: ماموریت، مرخصی ساعتی)</label>
                                <input
                                    type="text"
                                    id="description"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-md focus:outline-none"
                                    placeholder="اختیاری"
                                />
                             </div>
                        )}
                        
                        <button type="submit" disabled={isSaving || loading} className="w-full mt-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                            {isSaving ? 'در حال ثبت...' : (personStatus === 'present' ? 'ثبت خروج' : 'ثبت ورود')}
                        </button>
                    </form>

                    <div className="mt-6">
                        <h4 className="font-bold mb-2">ترددهای ثبت شده امروز</h4>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="min-w-full">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">ورود</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">خروج</th>
                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">شرح</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loading && <tr><td colSpan={3} className="text-center p-4">در حال بارگذاری...</td></tr>}
                                    {!loading && logs.length === 0 && <tr><td colSpan={3} className="text-center p-4 text-gray-500">ترددی برای امروز ثبت نشده.</td></tr>}
                                    {!loading && logs.map(log => (
                                        <tr key={log.id}>
                                            <td className="px-4 py-3 text-sm">{formatTime(log.entry_time)}</td>
                                            <td className="px-4 py-3 text-sm">{formatTime(log.exit_time)}</td>
                                            <td className="px-4 py-3 text-sm">{log.description || '---'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end items-center p-4 border-t bg-gray-50">
                    <button type="button" onClick={onClose} className="px-6 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
                        بستن
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MidDayLeaveModal;
