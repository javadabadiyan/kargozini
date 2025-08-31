import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { PencilIcon, SearchIcon, TrashIcon, UserIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';

declare const XLSX: any;

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآbادی',
];

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => 1402 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const PAGE_SIZE = 10;

const LOG_HEADER_MAP: { [key: string]: keyof Omit<CommuteLog, 'id' | 'full_name'> } = {
  'کد پرسنلی': 'personnel_code',
  'نام نگهبان': 'guard_name',
  'زمان ورود (ISO Format)': 'entry_time',
  'زمان خروج (ISO Format)': 'exit_time',
};

// Accurate Jalali to Gregorian conversion function
const jalaliToGregorian = (jy_str: string, jm_str: string, jd_str: string) => {
    const jy = parseInt(jy_str, 10);
    const jm = parseInt(jm_str, 10);
    const jd = parseInt(jd_str, 10);

    const sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const jy_temp = jy + 1595;
    let days = -355668 + (365 * jy_temp) + (Math.floor(jy_temp / 33) * 8) + Math.floor(((jy_temp % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
        gy += 100 * Math.floor(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days > 365) {
        gy += Math.floor((days - 1) / 365);
        days = (days - 1) % 365;
    }
    let gd = days + 1;
    sal_a[2] = ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28;
    let gm;
    for (gm = 1; gm <= 12; gm++) {
        if (gd <= sal_a[gm]) break;
        gd -= sal_a[gm];
    }
    return { gy, gm, gd };
};


const LogCommutePage: React.FC = () => {
  const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
  const [logs, setLogs] = useState<CommuteLog[]>([]);
  
  const [selectedGuard, setSelectedGuard] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<CommutingMember | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [manualDate, setManualDate] = useState({ year: '', month: '', day: '' });
  const [manualTime, setManualTime] = useState({ hour: '', minute: '' });

  // State for log list filtering and pagination
  const [searchDate, setSearchDate] = useState({ year: '', month: '', day: '' });
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(0);

  // Edit/Delete state
  const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  const getTodayPersian = () => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = formatter.formatToParts(today);
    return {
      year: parts.find(p => p.type === 'year')?.value || '',
      month: parts.find(p => p.type === 'month')?.value || '',
      day: parts.find(p => p.type === 'day')?.value || '',
    };
  };
  
  const dateToIsoString = (dateParts: {year: string, month: string, day: string}) => {
    if(!dateParts.year || !dateParts.month || !dateParts.day) return '';
    const { gy, gm, gd } = jalaliToGregorian(dateParts.year, dateParts.month, dateParts.day);
    const date = new Date(gy, gm - 1, gd);
    return date.toISOString().split('T')[0];
  }

  useEffect(() => {
    const today = getTodayPersian();
    setManualDate(today);
    setSearchDate(today);
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

  const fetchLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      setError(null);
      const isoDate = dateToIsoString(searchDate);
      const params = new URLSearchParams({
          page: String(logCurrentPage),
          pageSize: String(PAGE_SIZE),
          searchTerm: logSearchTerm,
          searchDate: isoDate,
      });
      const response = await fetch(`/api/commute-logs?${params.toString()}`);
      if (!response.ok) throw new Error('خطا در دریافت ترددها');
      const data = await response.json();
      setLogs(data.logs || []);
      setLogTotalPages(Math.ceil((data.totalCount || 0) / PAGE_SIZE));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setLoadingLogs(false);
    }
  }, [searchDate, logCurrentPage, logSearchTerm]);

  useEffect(() => {
    fetchCommutingMembers();
  }, [fetchCommutingMembers]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const { openLogs, completedLogs } = useMemo(() => {
    const open: CommuteLog[] = [];
    const completed: CommuteLog[] = [];
    logs.forEach(log => {
      if (log.exit_time) {
        completed.push(log);
      } else {
        open.push(log);
      }
    });
    return { openLogs: open, completedLogs: completed };
  }, [logs]);

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
  
  const getTimestampFromState = (): string | null => {
      const { year, month, day } = manualDate;
      const { hour, minute } = manualTime;

      if (!year || !month || !day || !hour || !minute) return null;

      const { gy, gm, gd } = jalaliToGregorian(year, month, day);
      const date = new Date(Date.UTC(gy, gm - 1, gd, parseInt(hour), parseInt(minute)));
      // Subtract 3.5 hours (210 minutes) to convert from Tehran local time to UTC
      date.setUTCMinutes(date.getUTCMinutes() - 210);
      
      return date.toISOString();
  };

  const handleLogCommute = async (action: 'entry' | 'exit') => {
    if (!selectedGuard || !selectedMember) {
      setStatus({ type: 'error', message: 'لطفاً نگهبان و پرسنل را انتخاب کنید.' });
      return;
    }
    
    const timestampOverride = getTimestampFromState();
    if((manualTime.hour || manualTime.minute) && !timestampOverride) {
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
      if (!response.ok) throw new Error(data.error || 'خطا در ثبت تردد');
      setStatus({ type: 'success', message: `تردد با موفقیت ثبت شد.`});
      setSelectedMember(null);
      setSearchTerm('');
      setManualTime({ hour: '', minute: ''});
      setSearchDate(manualDate);
      await fetchLogs();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
        setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleDirectExit = async (logId: number) => {
    if (!selectedGuard) {
      setStatus({ type: 'error', message: 'لطفاً ابتدا نگهبان را انتخاب کنید.' });
      return;
    }
    if (!window.confirm('آیا از ثبت خروج برای این پرسنل اطمینان دارید؟')) return;
    setStatus({ type: 'info', message: 'در حال ثبت خروج...'});
    try {
       const response = await fetch('/api/commute-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            guardName: selectedGuard,
            action: 'exit',
            logId: logId
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطا در ثبت خروج');
      setStatus({ type: 'success', message: `خروج با موفقیت ثبت شد.`});
      await fetchLogs();
    } catch(err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت خروج' });
    } finally {
        setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) return;
    setStatus({type: 'info', message: 'در حال حذف رکورد...'});
    try {
      const response = await fetch(`/api/commute-logs?id=${logId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطا در حذف');
      setStatus({type: 'success', message: 'رکورد با موفقیت حذف شد.'});
      setLogs(prev => prev.filter(log => log.id !== logId));
    } catch(err) {
      setStatus({type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف'});
    } finally {
      setTimeout(() => setStatus(null), 5000);
    }
  };
  
  const handleSaveLog = async (updatedLog: CommuteLog) => {
     setStatus({ type: 'info', message: 'در حال ویرایش تردد...'});
     try {
       const response = await fetch('/api/commute-logs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedLog),
       });
       const data = await response.json();
       if (!response.ok) throw new Error(data.error || 'خطا در ویرایش تردد');
       setStatus({type: 'success', message: 'تردد با موفقیت ویرایش شد.'});
       setLogs(prev => prev.map(l => l.id === data.log.id ? data.log : l));
       setIsEditModalOpen(false);
       setEditingLog(null);
     } catch(err) {
       setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته در ویرایش' });
     } finally {
       setTimeout(() => setStatus(null), 5000);
     }
  };


  const formatTime = (isoString: string | null) => {
    if (!isoString) return ' - ';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }));
  };

  const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
      {isEditModalOpen && editingLog && 
        <EditCommuteLogModal 
            log={editingLog} 
            guards={GUARDS}
            onClose={() => setIsEditModalOpen(false)} 
            onSave={handleSaveLog} 
        />
      }
      <div>
        <div className="border-b-2 border-gray-100 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">ثبت تردد پرسنل</h2>
        </div>

        {status && (<div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>)}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">۱. انتخاب نگهبان</label>
              <div className="flex flex-wrap gap-2">
                {GUARDS.map(guard => (
                  <label key={guard} className={`flex-grow text-center px-4 py-2 rounded-lg border cursor-pointer transition-colors ${selectedGuard === guard ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={e => setSelectedGuard(e.target.value)} className="sr-only" />
                    {guard}
                  </label>
                ))}
              </div>
          </div>
          <div className="space-y-4">
            <label htmlFor="personnel-search" className="block text-sm font-medium text-gray-700">۲. انتخاب پرسنل</label>
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" id="personnel-search" placeholder="نام یا کد پرسنلی..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedMember(null); }} onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" autoComplete="off" />
              {isSearchFocused && filteredMembers.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredMembers.map(m => (<li key={m.id} onMouseDown={() => handleSelectMember(m)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{m.full_name} ({toPersianDigits(m.personnel_code)})</li>))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 mt-4 border border-gray-200 rounded-lg bg-slate-50 space-y-4">
          <h4 className="font-semibold text-gray-700">۳. ثبت دستی تاریخ و زمان (اختیاری)</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ</label>
              <div className="grid grid-cols-3 gap-2">
                <select value={manualDate.day} onChange={e => setManualDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                <select value={manualDate.month} onChange={e => setManualDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                <select value={manualDate.year} onChange={e => setManualDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">زمان</label>
              <div className="grid grid-cols-2 gap-2">
                  <select value={manualTime.hour} onChange={e => setManualTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="">ساعت</option>{Array.from({length:24},(_,i)=>i).map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}</select>
                  <select value={manualTime.minute} onChange={e => setManualTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="">دقیقه</option>{Array.from({length:60},(_,i)=>i).map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}</select>
              </div>
            </div>
          </div>
        </div>
      
        <div className="flex items-center justify-center gap-4 pt-6 mt-4 border-t border-gray-100">
          <button onClick={() => handleLogCommute('entry')} disabled={!selectedGuard || !selectedMember} className="px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105">ثبت ورود</button>
          <button onClick={() => handleLogCommute('exit')} disabled={!selectedGuard || !selectedMember} className="px-8 py-3 text-lg font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105">ثبت خروج</button>
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-bold text-gray-700 mb-4 border-t pt-6">ورودهای باز امروز ({toPersianDigits(openLogs.length)})</h3>
        {openLogs.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-amber-50"><tr className="text-amber-800">
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">نام پرسنل</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">ساعت ورود</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase">نگهبان ثبت‌کننده</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">ثبت خروج</th>
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {openLogs.map(log => (
                  <tr key={log.id} className="hover:bg-amber-50/50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">{log.full_name || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{formatTime(log.entry_time)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.guard_name}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDirectExit(log.id)} disabled={!selectedGuard} className="px-4 py-1 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:bg-gray-300">ثبت خروج</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-center py-4 text-gray-500 bg-slate-50 rounded-lg">در حال حاضر هیچ ورود بازی برای امروز ثبت نشده است.</p>}
      </div>

      <div className="pt-6 border-t">
        <h3 className="text-xl font-bold text-gray-700 mb-4">تاریخچه ترددهای تکمیل‌شده</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-slate-50 border rounded-lg">
          <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">فیلتر تاریخ</label>
              <div className="grid grid-cols-3 gap-2">
                  <select value={searchDate.day} onChange={e => { setSearchDate(p => ({...p, day: e.target.value})); setLogCurrentPage(1);}} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                  <select value={searchDate.month} onChange={e => { setSearchDate(p => ({...p, month: e.target.value})); setLogCurrentPage(1);}} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                  <select value={searchDate.year} onChange={e => { setSearchDate(p => ({...p, year: e.target.value})); setLogCurrentPage(1);}} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
              </div>
          </div>
          <div>
              <label htmlFor="log-search" className="block text-sm font-medium text-gray-600 mb-1">جستجو</label>
              <input type="text" id="log-search" placeholder="نام یا کد پرسنلی..." value={logSearchTerm} onChange={e => {setLogSearchTerm(e.target.value); setLogCurrentPage(1);}} className="w-full pl-4 py-2 border border-gray-300 rounded-md"/>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">پرسنل</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">ورود/خروج</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نگهبان</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loadingLogs && <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr>}
              {!loadingLogs && completedLogs.length === 0 && (<tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ تردد تکمیل‌شده‌ای یافت نشد.</td></tr>)}
              {!loadingLogs && completedLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm"><div className="font-medium text-gray-800">{log.full_name || '-'}</div><div className="text-gray-500 font-mono">{toPersianDigits(log.personnel_code)}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">{formatTime(log.entry_time)} - {formatTime(log.exit_time)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.guard_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    <button onClick={() => {setEditingLog(log); setIsEditModalOpen(true);}} className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full transition-colors"><PencilIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full transition-colors mr-2"><TrashIcon className="w-5 h-5"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loadingLogs && !error && logTotalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
                <button onClick={() => setLogCurrentPage(p => Math.max(p - 1, 1))} disabled={logCurrentPage === 1} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                <span className="text-sm text-gray-600">صفحه {toPersianDigits(logCurrentPage)} از {toPersianDigits(logTotalPages)}</span>
                <button onClick={() => setLogCurrentPage(p => Math.min(p + 1, logTotalPages))} disabled={logCurrentPage === logTotalPages} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default LogCommutePage;