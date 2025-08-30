import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { SearchIcon, UserIcon } from '../icons/Icons';

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی',
];

const LogCommutePage: React.FC = () => {
  const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
  const [todaysLogs, setTodaysLogs] = useState<CommuteLog[]>([]);
  
  const [selectedGuard, setSelectedGuard] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<CommutingMember | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  
  const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  const fetchCommutingMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const response = await fetch('/api/commuting-members');
      if (!response.ok) throw new Error('خطا در دریافت لیست اعضای تردد');
      const data = await response.json();
      setCommutingMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchTodaysLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const response = await fetch('/api/commute-logs');
      if (!response.ok) throw new Error('خطا در دریافت ترددهای امروز');
      const data = await response.json();
      setTodaysLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchCommutingMembers();
    fetchTodaysLogs();
  }, [fetchCommutingMembers, fetchTodaysLogs]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    return commutingMembers.filter(m =>
      m.full_name.toLowerCase().includes(lowercasedTerm) ||
      m.personnel_code.includes(lowercasedTerm)
    );
  }, [searchTerm, commutingMembers]);

  const handleSelectMember = (member: CommutingMember) => {
    setSelectedMember(member);
    setSearchTerm(member.full_name);
    setIsSearchFocused(false);
  };

  const handleLogCommute = async (action: 'entry' | 'exit') => {
    if (!selectedGuard || !selectedMember) {
      setStatus({ type: 'error', message: 'لطفاً نگهبان و پرسنل را انتخاب کنید.' });
      return;
    }
    
    setStatus({ type: 'info', message: `در حال ثبت ${action === 'entry' ? 'ورود' : 'خروج'}...` });
    try {
      const response = await fetch('/api/commute-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            personnelCode: selectedMember.personnel_code,
            guardName: selectedGuard,
            action 
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'خطا در ثبت تردد');
      }
      setStatus({ type: 'success', message: `تردد با موفقیت ثبت شد.`});
      setSelectedMember(null);
      setSearchTerm('');
      fetchTodaysLogs(); // Refresh logs
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
        setTimeout(() => setStatus(null), 5000);
    }
  };
  
  const formatTime = (isoString: string | null) => {
    if (!isoString) return ' - ';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
  };

  const statusColor = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
      <div className="border-b-2 border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800">ثبت تردد پرسنل</h2>
      </div>

      {status && (
        <div className={`p-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
        <div>
          <label htmlFor="guard-select" className="block text-sm font-medium text-gray-700 mb-1">انتخاب نگهبان</label>
          <select 
            id="guard-select"
            value={selectedGuard}
            onChange={e => setSelectedGuard(e.target.value)}
            className="w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>شیفت کاری خود را انتخاب کنید</option>
            {GUARDS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        
        <div className="relative lg:col-span-2">
          <label htmlFor="personnel-search" className="block text-sm font-medium text-gray-700 mb-1">جستجوی پرسنل</label>
          <div className="relative">
            <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              id="personnel-search"
              placeholder="نام یا کد پرسنلی را وارد کنید..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setSelectedMember(null); }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
          </div>
          {isSearchFocused && filteredMembers.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredMembers.map(m => (
                <li key={m.id} onMouseDown={() => handleSelectMember(m)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                  {m.full_name} ({toPersianDigits(m.personnel_code)})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => handleLogCommute('entry')}
          disabled={!selectedGuard || !selectedMember}
          className="px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          ثبت ورود
        </button>
        <button
          onClick={() => handleLogCommute('exit')}
          disabled={!selectedGuard || !selectedMember}
          className="px-8 py-3 text-lg font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          ثبت خروج
        </button>
      </div>

      <div>
        <h3 className="text-xl font-bold text-gray-700 mb-4 mt-8">لیست تردد امروز</h3>
        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نام پرسنل</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">کد پرسنلی</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">ساعت ورود</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">ساعت خروج</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نگهبان ثبت کننده</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingLogs && <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr>}
              {error && <tr><td colSpan={5} className="text-center p-4 text-red-500">{error}</td></tr>}
              {!loadingLogs && todaysLogs.length === 0 && (
                <tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ ترددی برای امروز ثبت نشده است.</td></tr>
              )}
              {!loadingLogs && todaysLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">{log.full_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{toPersianDigits(log.personnel_code)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{formatTime(log.entry_time)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{formatTime(log.exit_time)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.guard_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LogCommutePage;
