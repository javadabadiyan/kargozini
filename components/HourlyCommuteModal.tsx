import React, { useState, useEffect, useCallback } from 'react';
import type { CommuteLog, HourlyCommuteLog } from '../types';
import { PencilIcon, TrashIcon, RefreshIcon } from './icons/Icons';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const jalaliToGregorian = (jy: number, jm: number, jd: number): [number, number, number] => {
    let sal_a, gy, gm, gd, j_day_no;
    sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    gy = jy + 621;
    let leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
    if (leap) sal_a[2] = 29;
    if (jm <= 6) j_day_no = (jm - 1) * 31 + jd;
    else j_day_no = 186 + (jm - 7) * 30 + jd;
    if (leap && j_day_no > 59) j_day_no++;
    if (j_day_no > 79) j_day_no -= 79;
    else { gy--; j_day_no += 286; leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0); if (leap) j_day_no++; }
    for (gm = 1; gm < 13; gm++) { if (j_day_no <= sal_a[gm]) break; j_day_no -= sal_a[gm]; }
    gd = j_day_no;
    return [gy, gm, gd];
};

interface HourlyCommuteModalProps {
  log: CommuteLog;
  guardName: string;
  date: { year: string, month: string, day: string };
  onClose: () => void;
}

const HourlyCommuteModal: React.FC<HourlyCommuteModalProps> = ({ log, guardName, date, onClose }) => {
  const [hourlyLogs, setHourlyLogs] = useState<HourlyCommuteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [editingLog, setEditingLog] = useState<HourlyCommuteLog | null>(null);
  const [openExitLog, setOpenExitLog] = useState<HourlyCommuteLog | null>(null);

  const [actionType, setActionType] = useState<'exit' | 'entry'>('exit');
  const [exitTime, setExitTime] = useState({ hour: '', minute: '' });
  const [entryTime, setEntryTime] = useState({ hour: '', minute: '' });
  const [reason, setReason] = useState('');
  
  const updateTimeToNow = useCallback(() => {
    const now = new Date();
    const currentHour = String(now.getHours());
    const currentMinute = String(now.getMinutes());
    return { hour: currentHour, minute: currentMinute };
  }, []);

  useEffect(() => {
    const now = updateTimeToNow();
    setExitTime(now);
    setEntryTime(now);
  }, [updateTimeToNow]);

  const fetchHourlyLogs = useCallback(async () => {
    setLoading(true);
    try {
      const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(date.year), parseInt(date.month), parseInt(date.day));
      const dateString = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
      const response = await fetch(`/api/commute-logs?entity=hourly&personnel_code=${log.personnel_code}&date=${dateString}`);
      if (!response.ok) throw new Error((await response.json()).error || 'خطا در دریافت اطلاعات');
      const data = await response.json();
      setHourlyLogs(data.logs || []);
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
      setLoading(false);
    }
  }, [log.personnel_code, date]);

  useEffect(() => {
    fetchHourlyLogs();
  }, [fetchHourlyLogs]);

  useEffect(() => {
    if (editingLog) {
      setOpenExitLog(null);
      return;
    }
    const openLog = hourlyLogs.find(log => log.exit_time && !log.entry_time);
    setOpenExitLog(openLog || null);

    if (openLog) {
      setActionType('entry');
    } else {
      setActionType('exit');
    }
  }, [hourlyLogs, editingLog]);

  const resetForm = () => {
    setEditingLog(null);
    const now = updateTimeToNow();
    setExitTime(now);
    setEntryTime(now);
    setReason('');
  };

  const handleActionTypeChange = (type: 'exit' | 'entry') => {
    setActionType(type);
    if (type === 'exit') setEntryTime(updateTimeToNow());
    else { setExitTime(updateTimeToNow()); setReason(''); }
  };

  const handleEditClick = (hLog: HourlyCommuteLog) => {
    setEditingLog(hLog);
    // When editing, get the LOCAL time parts from the stored ISO string.
    if (hLog.exit_time) {
      const exit = new Date(hLog.exit_time);
      setExitTime({ hour: String(exit.getHours()), minute: String(exit.getMinutes()) });
    } else {
      setExitTime({ hour: '', minute: '' });
    }
    if (hLog.entry_time) {
        const entry = new Date(hLog.entry_time);
        setEntryTime({ hour: String(entry.getHours()), minute: String(entry.getMinutes()) });
    } else {
        setEntryTime({ hour: '', minute: '' });
    }
    setReason(hLog.reason || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const getTimestamp = (time: {hour: string, minute: string}) => {
        if (!time.hour || !time.minute) return null;
        const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(date.year), parseInt(date.month), parseInt(date.day));
        const localDate = new Date(gYear, gMonth - 1, gDay, parseInt(time.hour), parseInt(time.minute));
        return localDate.toISOString();
    }

    let url: string;
    let method: 'POST' | 'PUT';
    let payload: any;
    let successMessage: string;

    if (openExitLog && !editingLog) {
        if (!entryTime.hour || !entryTime.minute) { setStatus({ type: 'error', message: 'ساعت بازگشت الزامی است.' }); return; }
        url = `/api/commute-logs?entity=hourly&id=${openExitLog.id}`;
        method = 'PUT';
        payload = { ...openExitLog, entry_time: getTimestamp(entryTime) };
        successMessage = 'بازگشت با موفقیت ثبت و تردد تکمیل شد.';
    } else if (editingLog) {
        url = `/api/commute-logs?entity=hourly&id=${editingLog.id}`;
        method = 'PUT';
        payload = { ...editingLog, exit_time: getTimestamp(exitTime), entry_time: getTimestamp(entryTime), reason: reason };
        successMessage = 'تغییرات با موفقیت ذخیره شد.';
    } else {
        if (actionType === 'exit' && (!exitTime.hour || !exitTime.minute)) { setStatus({ type: 'error', message: 'ساعت خروج الزامی است.' }); return; }
        if (actionType === 'entry' && (!entryTime.hour || !entryTime.minute)) { setStatus({ type: 'error', message: 'ساعت ورود الزامی است.' }); return; }
        url = '/api/commute-logs?entity=hourly';
        method = 'POST';
        payload = {
            personnel_code: log.personnel_code,
            full_name: log.full_name || log.personnel_code,
            guard_name: guardName,
            exit_time: actionType === 'exit' ? getTimestamp(exitTime) : null,
            entry_time: actionType === 'entry' ? getTimestamp(entryTime) : null,
            reason: actionType === 'exit' ? reason : null,
        };
        successMessage = actionType === 'exit' ? 'خروج ساعتی ثبت شد.' : 'ورود ساعتی ثبت شد.';
    }

    try {
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.details || data.error);
        setStatus({ type: 'success', message: successMessage });
        resetForm();
        fetchHourlyLogs();
    } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات' });
    } finally {
        setTimeout(() => setStatus(null), 4000);
    }
  };
  
  const handleLogReturn = async (hLog: HourlyCommuteLog) => {
      try {
        const response = await fetch(`/api/commute-logs?entity=hourly&id=${hLog.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...hLog, entry_time: new Date().toISOString() })
        });
        const data = await response.json();
        if(!response.ok) throw new Error(data.error);
        setStatus({ type: 'success', message: 'بازگشت با موفقیت ثبت شد.' });
        fetchHourlyLogs();
      } catch(err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت بازگشت' });
      } finally {
        setTimeout(() => setStatus(null), 4000);
      }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('آیا از حذف این تردد ساعتی اطمینان دارید؟')) {
        try {
            const response = await fetch(`/api/commute-logs?entity=hourly&id=${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error((await response.json()).error);
            setStatus({ type: 'success', message: 'رکورد با موفقیت حذف شد.' });
            fetchHourlyLogs();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
            setTimeout(() => setStatus(null), 4000);
        }
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
  };

  const calculateDuration = (exit: string | null, entry: string | null): string => {
    if (exit && entry) {
        const diff = (new Date(entry).getTime() - new Date(exit).getTime()) / 60000;
        if (diff < 0) return 'نامعتبر';
        const hours = Math.floor(diff / 60);
        const minutes = Math.round(diff % 60);
        return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(minutes)} دقیقه`;
    }
    if (exit && !entry) return 'در حال انجام';
    if (!exit && entry) return 'ورود ثبت شده';
    return '---';
  };
  
  const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">ثبت تردد بین ساعتی برای: {log.full_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-slate-50 space-y-4">
            <h4 className="font-bold text-lg text-gray-700">{editingLog ? 'ویرایش تردد' : openExitLog ? 'تکمیل تردد خروج' : 'افزودن تردد جدید'}</h4>
            
            {openExitLog && !editingLog && (
                <div className="p-3 text-sm rounded-lg bg-yellow-100 text-yellow-800 text-center">
                    یک خروج باز در ساعت {formatTime(openExitLog.exit_time)} ثبت شده است. لطفاً ساعت بازگشت را وارد کنید.
                </div>
            )}
            
            {!editingLog && !openExitLog && (
                <div>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200 rounded-lg">
                        <button type="button" onClick={() => handleActionTypeChange('exit')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${actionType === 'exit' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                            ثبت خروج
                        </button>
                        <button type="button" onClick={() => handleActionTypeChange('entry')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${actionType === 'entry' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                            ثبت ورود
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={!editingLog && (actionType === 'entry' || !!openExitLog) ? 'opacity-50' : ''}>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">ساعت خروج</label>
                        <button type="button" onClick={() => setExitTime(updateTimeToNow())} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full" title="بروزرسانی ساعت خروج" disabled={!editingLog && (actionType === 'entry' || !!openExitLog)}>
                           <RefreshIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select disabled={!editingLog && (actionType === 'entry' || !!openExitLog)} value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                        <select disabled={!editingLog && (actionType === 'entry' || !!openExitLog)} value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                    </div>
                </div>
                <div className={!editingLog && actionType === 'exit' && !openExitLog ? 'opacity-50' : ''}>
                     <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">ساعت ورود</label>
                         <button type="button" onClick={() => setEntryTime(updateTimeToNow())} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full" title="بروزرسانی ساعت ورود" disabled={!editingLog && actionType === 'exit' && !openExitLog}>
                           <RefreshIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <select disabled={!editingLog && actionType === 'exit' && !openExitLog} value={entryTime.hour} onChange={e => setEntryTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                        <select disabled={!editingLog && actionType === 'exit' && !openExitLog} value={entryTime.minute} onChange={e => setEntryTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                    </div>
                </div>
            </div>
            <div className={!editingLog && (actionType === 'entry' || !!openExitLog) ? 'hidden' : ''}>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">شرح (مثال: ماموریت، مرخصی ساعتی)</label>
              <input id="reason" value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" placeholder="اختیاری"/>
            </div>
            <div className="flex items-center justify-end gap-2">
                {editingLog && <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">لغو ویرایش</button>}
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingLog ? 'ذخیره تغییرات' : openExitLog ? 'ثبت بازگشت' : (actionType === 'exit' ? 'افزودن خروج' : 'افزودن ورود')}</button>
            </div>
          </form>

          {status && <div className={`p-3 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

          <div>
            <h4 className="font-bold text-lg text-gray-700 mb-2">ترددهای ثبت شده</h4>
            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            {['خروج', 'ورود', 'مدت', 'شرح', 'عملیات'].map(h => <th key={h} className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr> :
                         hourlyLogs.length === 0 ? <tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ تردد ساعتی برای این فرد ثبت نشده.</td></tr> :
                         hourlyLogs.map(hLog => (
                            <tr key={hLog.id} className="hover:bg-slate-50">
                                <td className="px-3 py-2 whitespace-nowrap text-sm">{formatTime(hLog.exit_time)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">{formatTime(hLog.entry_time)}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">{calculateDuration(hLog.exit_time, hLog.entry_time)}</td>
                                <td className="px-3 py-2 text-sm max-w-xs truncate">{hLog.reason || '-'}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-1">
                                        {!hLog.entry_time && hLog.exit_time && <button onClick={() => handleLogReturn(hLog)} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200">ثبت بازگشت</button>}
                                        <button onClick={() => handleEditClick(hLog)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-md"><PencilIcon className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(hLog.id)} className="p-1 text-red-600 hover:bg-red-100 rounded-md"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                         ))}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HourlyCommuteModal;