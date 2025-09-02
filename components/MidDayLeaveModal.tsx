import React, { useState, useEffect, useCallback } from 'react';
import type { CommuteLog } from '../types';
import { PencilIcon, TrashIcon, XIcon } from './icons/Icons';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toPersianDigits = (s: string | number | null | undefined): string => {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatTime = (isoString: string | null) => {
    if (!isoString) return '---';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
};


interface MidDayLeaveModalProps {
  personnel: CommuteLog;
  guardName: string;
  onClose: () => void;
  onUpdate: () => void;
}

const MidDayLeaveModal: React.FC<MidDayLeaveModalProps> = ({ personnel, guardName, onClose, onUpdate }) => {
  const [logs, setLogs] = useState<CommuteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'exit' | 'entry'>('exit');

  const [time, setTime] = useState({ hour: '', minute: '' });
  const [description, setDescription] = useState('');

  const isClockedIn = logs.some(log => !log.exit_time);

  const getTodayGregorian = () => {
      const entryDate = new Date(personnel.entry_time);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(entryDate);
  }

  const fetchPersonnelLogs = useCallback(async () => {
    setLoading(true);
    try {
      const dateString = getTodayGregorian();
      const response = await fetch(`/api/commute-logs?date=${dateString}&personnel_code=${personnel.personnel_code}`);
      if (!response.ok) throw new Error('خطا در دریافت ترددها');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
      setLoading(false);
    }
  }, [personnel.personnel_code, personnel.entry_time]);

  useEffect(() => {
    fetchPersonnelLogs();
    const now = new Date();
    setTime({ hour: String(now.getHours()), minute: String(now.getMinutes()) });
  }, [fetchPersonnelLogs]);

  const getTimestampOverride = () => {
    if (!time.hour || !time.minute) return null;
    const baseDate = new Date(personnel.entry_time);
    const tehranDate = new Date(baseDate.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    
    const year = tehranDate.getFullYear();
    const month = tehranDate.getMonth();
    const day = tehranDate.getDate();

    const date = new Date(Date.UTC(year, month, day, parseInt(time.hour), parseInt(time.minute)));
    date.setMinutes(date.getMinutes() - 210); // Adjust for Iran's timezone offset from UTC
    return date.toISOString();
  };

  const handleSubmit = async () => {
    setStatus({ type: 'info', message: 'در حال ثبت...' });

    const body: any = {
      personnelCode: personnel.personnel_code,
      guardName,
      action: activeTab,
      timestampOverride: getTimestampOverride(),
    };

    if (activeTab === 'exit') {
      body.description = description;
    }

    try {
      const response = await fetch('/api/commute-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Reset form and refetch data
      setDescription('');
      const now = new Date();
      setTime({ hour: String(now.getHours()), minute: String(now.getMinutes()) });
      await fetchPersonnelLogs();
      onUpdate(); // Notify parent to refetch and show global status
      onClose(); // Close modal on success
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    }
  };

  const calculateDuration = (entry: string, exit: string | null) => {
    if(!exit) return 'در حال انجام';
    const diff = new Date(entry).getTime() - new Date(exit).getTime();
    if(diff < 0) return 'نامعتبر';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return toPersianDigits(`${hours} ساعت و ${minutes} دقیقه`);
  };

  const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">ثبت تردد بین ساعتی برای: {personnel.full_name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="w-6 h-6" /></button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {status && <div className={`p-3 my-2 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
          
          <div className="border rounded-lg p-4">
            <h4 className="font-semibold mb-3">افزودن تردد جدید</h4>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200 rounded-lg mb-4">
              <button onClick={() => setActiveTab('exit')} disabled={!isClockedIn} className={`py-2 text-sm rounded-md transition-colors ${activeTab === 'exit' ? 'bg-white shadow' : ''} ${!isClockedIn ? 'cursor-not-allowed text-gray-400' : 'text-gray-700'}`}>ثبت خروج</button>
              <button onClick={() => setActiveTab('entry')} disabled={isClockedIn} className={`py-2 text-sm rounded-md transition-colors ${activeTab === 'entry' ? 'bg-white shadow' : ''} ${isClockedIn ? 'cursor-not-allowed text-gray-400' : 'text-gray-700'}`}>ثبت ورود</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ساعت {activeTab === 'exit' ? 'خروج' : 'ورود'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={time.hour} onChange={e => setTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                    {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                  </select>
                  <select value={time.minute} onChange={e => setTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                    {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                  </select>
                </div>
              </div>
              
              {activeTab === 'exit' && (
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">شرح (مثال: ماموریت، مرخصی ساعتی)</label>
                  <input type="text" id="description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" placeholder="اختیاری"/>
                </div>
              )}
              
              <button onClick={handleSubmit} disabled={(activeTab === 'exit' && !isClockedIn) || (activeTab === 'entry' && isClockedIn)} className="w-full py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                افزودن {activeTab === 'exit' ? 'خروج' : 'ورود'}
              </button>
            </div>
          </div>

          <div className="border rounded-lg">
            <h4 className="font-semibold p-4 border-b">ترددهای ثبت شده امروز</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">ورود</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">خروج</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">مدت حضور</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-500 uppercase">شرح خروج</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading && <tr><td colSpan={4} className="text-center p-4">در حال بارگذاری...</td></tr>}
                  {!loading && logs.map(log => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatTime(log.entry_time)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatTime(log.exit_time)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{calculateDuration(log.exit_time || new Date().toISOString(), log.entry_time)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{log.description || '---'}</td>
                    </tr>
                  ))}
                   {!loading && logs.length === 0 && <tr><td colSpan={4} className="text-center p-4 text-gray-500">ترددی ثبت نشده است.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end items-center p-4 border-t bg-gray-50 mt-auto">
          <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

export default MidDayLeaveModal;