import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { SearchIcon, UserIcon, PencilIcon, TrashIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی',
];

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 1490 - 1402 }, (_, i) => 1403 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);


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
  
  const [logDate, setLogDate] = useState({ year: '', month: '', day: '' });
  const [entryTime, setEntryTime] = useState({ hour: '', minute: '' });
  const [exitTime, setExitTime] = useState({ hour: '', minute: '' });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);

  const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  const getTodayPersian = () => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(today);
    const year = parts.find(p => p.type === 'year')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    return { year, month, day };
  };

  useEffect(() => {
    setLogDate(getTodayPersian());
  }, []);


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

  const groupedAndFilteredMembers = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    
    const filteredGroups = commutingMembers.reduce((acc, member) => {
        if (
            !lowercasedTerm || 
            member.full_name.toLowerCase().includes(lowercasedTerm) || 
            member.personnel_code.includes(lowercasedTerm)
        ) {
            const department = member.department || 'بدون واحد';
            if (!acc[department]) {
                acc[department] = [];
            }
            acc[department].push(member);
        }
        return acc;
    }, {} as Record<string, CommutingMember[]>);

    return Object.entries(filteredGroups).sort(([a], [b]) => a.localeCompare(b, 'fa'));
  }, [searchTerm, commutingMembers]);


  const handleSelectMember = (member: CommutingMember) => {
    setSelectedMember(member);
    setSearchTerm(member.full_name);
    setIsSearchFocused(false);
  };

  const getTimestampFromState = (timeState: { hour: string; minute: string }): string | null => {
      const { year, month, day } = logDate;
      const { hour, minute } = timeState;

      if (!year || !month || !day || !hour || !minute) return null;

      const pYear = parseInt(year);
      const pMonth = parseInt(month);
      const pDay = parseInt(day);

      // Approximate Gregorian conversion
      const gYear = pYear + 621;

      // Create date in UTC to avoid timezone issues
      const dateObj = new Date(Date.UTC(gYear, pMonth - 1, pDay, parseInt(hour), parseInt(minute)));
      
      // Adjust for Iran timezone offset (+3:30)
      dateObj.setUTCMinutes(dateObj.getUTCMinutes() - 210);

      return dateObj.toISOString();
  };

  const handleLogCommute = async (action: 'entry' | 'exit') => {
    if (!selectedGuard || !selectedMember) {
      setStatus({ type: 'error', message: 'لطفاً نگهبان و پرسنل را انتخاب کنید.' });
      return;
    }
    
    const timeToUse = action === 'entry' ? entryTime : exitTime;
    const timestampOverride = getTimestampFromState(timeToUse);
    const isManualEntry = timeToUse.hour && timeToUse.minute;

    if(isManualEntry && !timestampOverride) {
      setStatus({ type: 'error', message: 'لطفاً تاریخ و زمان را به طور کامل وارد کنید.'});
      return;
    }

    setStatus({ type: 'info', message: `در حال ثبت ${action === 'entry' ? 'ورود' : 'خروج'}...` });
    try {
      const response = await fetch('/api/commute-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            personnelCode: selectedMember.personnel_code,
            guardName: selectedGuard,
            action,
            timestampOverride
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'خطا در ثبت تردد');
      }
      setStatus({ type: 'success', message: `تردد با موفقیت ثبت شد.`});
      setSelectedMember(null);
      setSearchTerm('');
      setEntryTime({ hour: '', minute: ''});
      setExitTime({ hour: '', minute: ''});
      fetchTodaysLogs(); // Refresh logs
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
        setTimeout(() => setStatus(null), 5000);
    }
  };
  
  const handleEditClick = (log: CommuteLog) => {
    setEditingLog(log);
    setIsEditModalOpen(true);
  };

  const handleDeleteLog = async (id: number) => {
    if (window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) {
      setStatus({ type: 'info', message: 'در حال حذف رکورد...' });
      try {
        const response = await fetch('/api/commute-logs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'خطا در حذف');
        setStatus({ type: 'success', message: 'رکورد با موفقیت حذف شد.' });
        fetchTodaysLogs();
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
      } finally {
        setTimeout(() => setStatus(null), 5000);
      }
    }
  };
  
  const handleSaveLog = async (updatedLog: CommuteLog) => {
    setStatus({ type: 'info', message: 'در حال ویرایش رکورد...' });
    try {
        const response = await fetch('/api/commute-logs', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedLog),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'خطا در ویرایش');
        
        setStatus({ type: 'success', message: 'رکورد با موفقیت ویرایش شد.' });
        setTodaysLogs(prev => prev.map(log => log.id === data.log.id ? data.log : log));
        setIsEditModalOpen(false);
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
    <>
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
      <div className="border-b-2 border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800">ثبت تردد پرسنل</h2>
      </div>

      {status && (
        <div className={`p-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">انتخاب نگهبان</label>
          <div className="flex flex-wrap gap-3">
            {GUARDS.map(guard => (
              <label key={guard} className={`flex items-center px-4 py-2 rounded-lg border cursor-pointer transition-colors ${selectedGuard === guard ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="guard"
                  value={guard}
                  checked={selectedGuard === guard}
                  onChange={e => setSelectedGuard(e.target.value)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 ml-2"
                />
                {guard}
              </label>
            ))}
          </div>
        </div>
        
        <div className="relative">
          <label htmlFor="personnel-search" className="block text-sm font-medium text-gray-700 mb-1">جستجوی پرسنل</label>
          <div className="relative">
            <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" id="personnel-search" placeholder="نام یا کد پرسنلی را وارد کنید..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setSelectedMember(null); }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              autoComplete="off"
            />
          </div>
           {isSearchFocused && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
              {groupedAndFilteredMembers.length > 0 ? (
                groupedAndFilteredMembers.map(([department, members]) => (
                  <div key={department} className="p-2 border-b last:border-b-0">
                    <p className="px-2 py-1 text-xs font-bold text-gray-500 bg-gray-100 rounded-sm sticky top-0">{department}</p>
                    <ul className="mt-1">
                      {members.map(member => (
                        <li 
                          key={member.id} 
                          onMouseDown={() => handleSelectMember(member)} 
                          className="px-2 py-2 rounded-md hover:bg-blue-50 cursor-pointer text-sm"
                        >
                          <div className="flex justify-between items-center">
                              <span>{member.full_name}</span>
                              <span className="text-xs text-gray-400 font-mono">{toPersianDigits(member.personnel_code)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="p-4 text-sm text-center text-gray-500">
                  {searchTerm ? "هیچ پرسنلی با این مشخصات یافت نشد." : "لیست اعضای تردد خالی است."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border border-gray-200 rounded-lg bg-slate-50 space-y-4">
          <h4 className="font-semibold text-gray-700">ثبت دستی تاریخ و زمان (اختیاری)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {/* Date */}
            <div className="lg:col-span-3 grid grid-cols-3 gap-2">
                <select value={logDate.day} onChange={e => setLogDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                  <option value="" disabled>روز</option>
                  {DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}
                </select>
                <select value={logDate.month} onChange={e => setLogDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                   <option value="" disabled>ماه</option>
                  {PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
                <select value={logDate.year} onChange={e => setLogDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md">
                   <option value="" disabled>سال</option>
                  {YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
                </select>
            </div>
            {/* Entry Time */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                <select value={entryTime.hour} onChange={e => setEntryTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md" aria-label="ساعت ورود">
                   <option value="">ساعت ورود</option>
                   {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={entryTime.minute} onChange={e => setEntryTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md" aria-label="دقیقه ورود">
                   <option value="">دقیقه ورود</option>
                   {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
            </div>
             {/* Exit Time */}
             <div className="lg:col-span-2 grid grid-cols-2 gap-2">
                <select value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md" aria-label="ساعت خروج">
                   <option value="">ساعت خروج</option>
                   {HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md" aria-label="دقیقه خروج">
                   <option value="">دقیقه خروج</option>
                   {MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
            </div>
          </div>
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
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">عملیات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingLogs && <tr><td colSpan={6} className="text-center p-4">در حال بارگذاری...</td></tr>}
              {error && <tr><td colSpan={6} className="text-center p-4 text-red-500">{error}</td></tr>}
              {!loadingLogs && todaysLogs.length === 0 && (
                <tr><td colSpan={6} className="text-center p-4 text-gray-500">هیچ ترددی برای امروز ثبت نشده است.</td></tr>
              )}
              {!loadingLogs && todaysLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">{log.full_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{toPersianDigits(log.personnel_code)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{formatTime(log.entry_time)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{formatTime(log.exit_time)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.guard_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEditClick(log)} className="p-1 text-blue-600 hover:text-blue-800" aria-label={`ویرایش تردد ${log.full_name}`}>
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-red-600 hover:text-red-800" aria-label={`حذف تردد ${log.full_name}`}>
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    {isEditModalOpen && editingLog && (
        <EditCommuteLogModal
          log={editingLog}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleSaveLog}
        />
    )}
    </>
  );
};

export default LogCommutePage;