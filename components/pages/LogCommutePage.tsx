import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { SearchIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, TrashIcon, PlusCircleIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import AddShortLeaveModal from '../AddShortLeaveModal';


declare const XLSX: any;

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآbادی',
];

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => 1402 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const jalaliToGregorian = (jy_str: string, jm_str: string, jd_str: string) => {
    const jy = parseInt(jy_str, 10);
    const jm = parseInt(jm_str, 10);
    const jd = parseInt(jd_str, 10);
    const sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const jy_temp = jy + 1595;
    let days = -355668 + (365 * jy_temp) + (Math.floor(jy_temp / 33) * 8) + Math.floor(((jy_temp % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097); days %= 146097; if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; } gy += 4 * Math.floor(days / 1461); days %= 1461; if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; } let gd = days + 1; sal_a[2] = ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28; let gm; for (gm = 1; gm <= 12; gm++) { if (gd <= sal_a[gm]) break; gd -= sal_a[gm]; } return { gy, gm, gd };
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

const LogCommutePage: React.FC = () => {
  const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
  const [logs, setLogs] = useState<CommuteLog[]>([]);
  
  const [selectedGuard, setSelectedGuard] = useState<string>('');
  const [personnelSearchTerm, setPersonnelSearchTerm] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<CommutingMember[]>([]);
  
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  
  const [operationType, setOperationType] = useState<'entry' | 'exit'>('entry');
  const [manualDate, setManualDate] = useState({ year: '', month: '', day: '' });
  const [manualTime, setManualTime] = useState({ hour: '', minute: '' });

  const [openDepartments, setOpenDepartments] = useState<Record<string, boolean>>({});

  const [searchDate, setSearchDate] = useState(getTodayPersian());
  const [currentLogPage, setCurrentLogPage] = useState(1);
  const [totalLogPages, setTotalLogPages] = useState(0);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
  const [isShortLeaveModalOpen, setIsShortLeaveModalOpen] = useState(false);

  const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  useEffect(() => {
    const today = getTodayPersian();
    const now = new Date();
    setManualDate(today);
    setManualTime({ 
      hour: now.getHours().toString(), 
      minute: now.getMinutes().toString() 
    });
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

  const fetchLogs = useCallback(async (page: number) => {
    setLoadingLogs(true);
    try {
        const { year, month, day } = searchDate;
        if (!year || !month || !day) return;

        const {gy, gm, gd} = jalaliToGregorian(year, month, day);
        const gregorianDateStr = `${gy}-${String(gm).padStart(2,'0')}-${String(gd).padStart(2,'0')}`;

        const response = await fetch(`/api/commute-logs?page=${page}&searchDate=${gregorianDateStr}`);
        if(!response.ok) throw new Error('خطا در دریافت تاریخچه تردد');
        const data = await response.json();
        setLogs(data.logs || []);
        setTotalLogPages(Math.ceil((data.totalCount || 0) / 10));
    } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
        setLoadingLogs(false);
    }
  }, [searchDate]);

  useEffect(() => {
    fetchCommutingMembers();
  }, [fetchCommutingMembers]);

  useEffect(() => {
    fetchLogs(currentLogPage);
  }, [currentLogPage, fetchLogs]);


  const membersByDepartment = useMemo(() => {
    const lowercasedTerm = personnelSearchTerm.toLowerCase().trim();
    
    const filtered = commutingMembers.filter(m => 
      !lowercasedTerm || 
      m.full_name.toLowerCase().includes(lowercasedTerm) || 
      m.personnel_code.includes(lowercasedTerm)
    );

    const grouped: { [key: string]: CommutingMember[] } = {};
    filtered.forEach(member => {
      const dept = member.department || 'بدون واحد';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(member);
    });

    const sortedGrouped: { [key: string]: CommutingMember[] } = {};
    Object.keys(grouped).sort().forEach(key => {
        sortedGrouped[key] = grouped[key].sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa'));
    });

    return sortedGrouped;
  }, [commutingMembers, personnelSearchTerm]);
  
  const handleToggleMember = (member: CommutingMember) => {
    setSelectedMembers(prev => prev.some(m => m.id === member.id) ? prev.filter(m => m.id !== member.id) : [...prev, member]);
  };
  
  const handleToggleDepartmentAccordion = (dept: string) => {
    setOpenDepartments(prev => ({ ...prev, [dept]: !prev[dept] }));
  };
  
  const handleSelectAllInDepartment = (membersInDept: CommutingMember[], allCurrentlySelected: boolean) => {
    const memberIdsInDept = new Set(membersInDept.map(m => m.id));
    setSelectedMembers(prev => allCurrentlySelected ? prev.filter(m => !memberIdsInDept.has(m.id)) : [...prev, ...membersInDept.filter(m => !prev.some(pm => pm.id === m.id))]);
  };

  const getTimestampFromState = (): string | null => {
      const { year, month, day } = manualDate;
      const { hour, minute } = manualTime;
      if (!year || !month || !day || hour === '' || minute === '') return null;
      const { gy, gm, gd } = jalaliToGregorian(year, month, day);
      const date = new Date(Date.UTC(gy, gm - 1, gd, parseInt(hour), parseInt(minute)));
      date.setUTCMinutes(date.getUTCMinutes() - 210);
      return date.toISOString();
  };

  const handleLogCommute = async () => {
    if (!selectedGuard || selectedMembers.length === 0) {
      setStatus({ type: 'error', message: 'لطفاً نگهبان و حداقل یک پرسنل را انتخاب کنید.' }); return;
    }
    const timestampOverride = getTimestampFromState();
    setStatus({ type: 'info', message: `در حال ثبت ${operationType === 'entry' ? 'ورود' : 'خروج'} برای ${toPersianDigits(selectedMembers.length)} نفر...` });
    try {
      const response = await fetch('/api/commute-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            personnelCodes: selectedMembers.map(m => m.personnel_code),
            guardName: selectedGuard,
            action: operationType,
            timestampOverride
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطا در ثبت تردد');
      setStatus({ type: 'success', message: data.message});
      setSelectedMembers([]);
      setPersonnelSearchTerm('');
      
      const today = getTodayPersian();
      if(manualDate.year === today.year && manualDate.month === today.month && manualDate.day === today.day) {
        fetchLogs(1);
      }
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
  
  const handleSaveLog = async (updatedLog: CommuteLog) => {
      try {
          const res = await fetch('/api/commute-logs', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(updatedLog)});
          if(!res.ok) { const data = await res.json(); throw new Error(data.error || 'خطا در ذخیره'); }
          setStatus({type: 'success', message: 'تردد با موفقیت ویرایش شد.'});
          setIsEditModalOpen(false);
          setEditingLog(null);
          fetchLogs(currentLogPage);
      } catch(err) {
          setStatus({type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته'});
      } finally {
        setTimeout(() => setStatus(null), 5000);
      }
  };

  const handleDeleteLog = async (logId: number) => {
      if(window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) {
          try {
              const res = await fetch(`/api/commute-logs?id=${logId}`, { method: 'DELETE' });
              if(!res.ok) { const data = await res.json(); throw new Error(data.error || 'خطا در حذف'); }
              setStatus({type: 'success', message: 'تردد با موفقیت حذف شد.'});
              fetchLogs(currentLogPage);
          } catch(err) {
              setStatus({type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته'});
          } finally {
            setTimeout(() => setStatus(null), 5000);
          }
      }
  };
  
  const handleSaveShortLeave = async (data: any) => {
    try {
      const res = await fetch('/api/commute-logs', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({...data, action: 'short_leave'}),
      });
      if(!res.ok) { const err = await res.json(); throw new Error(err.error); }
      setStatus({type: 'success', message: 'تردد بین‌ساعتی با موفقیت ثبت شد.'});
      setIsShortLeaveModalOpen(false);
      fetchLogs(currentLogPage);
    } catch(err) {
      setStatus({type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته'});
    } finally {
        setTimeout(() => setStatus(null), 5000);
    }
  };

  const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-4">
      {/* Left Column: History */}
      <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b pb-4">
            <h2 className="text-xl font-bold text-gray-800">ترددهای ثبت شده</h2>
            <div className="flex items-center gap-2">
                <select value={searchDate.day} onChange={e => setSearchDate(p => ({...p, day: e.target.value}))} className="p-2 border rounded-md text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                <select value={searchDate.month} onChange={e => setSearchDate(p => ({...p, month: e.target.value}))} className="p-2 border rounded-md text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                <select value={searchDate.year} onChange={e => setSearchDate(p => ({...p, year: e.target.value}))} className="p-2 border rounded-md text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
            </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
                <button onClick={() => setIsShortLeaveModalOpen(true)} className="flex items-center px-3 py-2 bg-teal-500 text-white text-sm rounded-lg hover:bg-teal-600">
                    <PlusCircleIcon className="w-5 h-5 ml-1" />
                    تردد بین‌ساعتی
                </button>
            </div>
        </div>

        {status && (<div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>)}

        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">پرسنل</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">شیفت</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">ورود</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">خروج</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">نوع</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">عملیات</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {loadingLogs ? (<tr><td colSpan={6} className="text-center p-4">در حال بارگذاری...</td></tr>)
                    : logs.length === 0 ? (<tr><td colSpan={6} className="text-center p-4 text-gray-500">هیچ ترددی برای این روز ثبت نشده است.</td></tr>)
                    : logs.map(log => (
                        <tr key={log.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{log.full_name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{log.guard_name.split('|')[0].trim()}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 tracking-wider font-sans">{toPersianDigits(log.entry_time ? new Date(log.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }) : '-')}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 tracking-wider font-sans">{toPersianDigits(log.exit_time ? new Date(log.exit_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }) : '-')}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{log.log_type === 'short_leave' ? 'بین‌ساعتی' : 'اصلی'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                <button onClick={() => handleEditClick(log)} className="text-blue-600 hover:text-blue-900 p-1"><PencilIcon className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteLog(log.id)} className="text-red-600 hover:text-red-900 mr-2 p-1"><TrashIcon className="w-4 h-4" /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {totalLogPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
                <button onClick={() => setCurrentLogPage(p => Math.max(1, p-1))} disabled={currentLogPage === 1} className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50">قبلی</button>
                <span>صفحه {toPersianDigits(currentLogPage)} از {toPersianDigits(totalLogPages)}</span>
                <button onClick={() => setCurrentLogPage(p => Math.min(totalLogPages, p+1))} disabled={currentLogPage === totalLogPages} className="px-4 py-2 text-sm rounded-lg border disabled:opacity-50">بعدی</button>
            </div>
        )}
      </div>

      {/* Right Column: Logging Form */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg space-y-6 h-fit">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ثبت تردد</h2>
          <p className="text-sm text-gray-500">ورود و خروج پرسنل را در شیفت‌های مختلف ثبت کنید.</p>
        </div>
        <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">شیفت کاری</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {GUARDS.map(guard => (
                <label key={guard} className={`text-center px-4 py-2 rounded-lg border cursor-pointer transition-colors ${selectedGuard === guard ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>
                <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={e => setSelectedGuard(e.target.value)} className="sr-only" />
                {guard.split('|')[1].trim()} <span className="text-xs opacity-80">{guard.split('|')[0].trim()}</span>
                </label>
            ))}
            </div>
        </div>
        <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">نوع عملیات</label>
             <div className="flex items-center rounded-lg border border-gray-300 p-1 bg-gray-100">
                <button onClick={() => setOperationType('entry')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${operationType === 'entry' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>ثبت ورود</button>
                <button onClick={() => setOperationType('exit')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${operationType === 'exit' ? 'bg-red-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}>ثبت خروج</button>
            </div>
        </div>
        <div className="p-4 border border-gray-200 rounded-lg bg-slate-50 space-y-3">
          <h4 className="font-semibold text-gray-700 text-sm">{operationType === 'entry' ? 'تاریخ و زمان ورود (اختیاری)' : 'تاریخ و زمان خروج (اختیاری)'}</h4>
          <p className="text-xs text-gray-500">اگر خالی باشد، زمان فعلی سیستم ثبت می‌شود.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select value={manualDate.day} onChange={e => setManualDate(p => ({...p, day: e.target.value}))} className="p-2 border rounded-md text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
              <select value={manualDate.month} onChange={e => setManualDate(p => ({...p, month: e.target.value}))} className="md:col-span-1 p-2 border rounded-md text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
              <select value={manualDate.year} onChange={e => setManualDate(p => ({...p, year: e.target.value}))} className="md:col-span-1 p-2 border rounded-md text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
              <select value={manualTime.hour} onChange={e => setManualTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border rounded-md text-sm"><option value="">ساعت</option>{Array.from({length:24},(_,i)=>i).map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}</select>
              <select value={manualTime.minute} onChange={e => setManualTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border rounded-md text-sm"><option value="">دقیقه</option>{Array.from({length:60},(_,i)=>i).map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}</select>
          </div>
        </div>
        <div className="space-y-4">
            <label htmlFor="personnel-search" className="block text-sm font-medium text-gray-700">انتخاب پرسنل ({toPersianDigits(selectedMembers.length)} نفر)</label>
            <div className="relative">
              <input type="text" id="personnel-search" placeholder="جستجوی پرسنل..." value={personnelSearchTerm} onChange={e => setPersonnelSearchTerm(e.target.value)} className="w-full pl-4 pr-10 py-2 border rounded-md" autoComplete="off" />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <div className="border rounded-lg max-h-60 overflow-y-auto bg-slate-50">
              {Object.entries(membersByDepartment).length > 0 ? Object.entries(membersByDepartment).map(([department, members]) => {
                  const allInDeptSelected = members.length > 0 && members.every(m => selectedMembers.some(sm => sm.id === m.id));
                  return (
                    <div key={department} className="border-b last:border-b-0">
                      <div className="flex items-center p-3 bg-slate-100 hover:bg-slate-200 cursor-pointer" onClick={() => handleToggleDepartmentAccordion(department)}>
                        <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded ml-3" checked={allInDeptSelected} onChange={() => handleSelectAllInDepartment(members, allInDeptSelected)} onClick={(e) => e.stopPropagation()} />
                        <span className="font-semibold text-gray-700 flex-1">{department}</span>
                        {openDepartments[department] ? <ChevronUpIcon className="w-5 h-5 text-gray-600" /> : <ChevronDownIcon className="w-5 h-5 text-gray-600" />}
                      </div>
                      {openDepartments[department] && (
                        <div className="p-2 pl-8 bg-white">{members.map(member => (
                            <label key={member.id} className="flex items-center my-2 cursor-pointer">
                              <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded ml-3" checked={selectedMembers.some(m => m.id === member.id)} onChange={() => handleToggleMember(member)} />
                              <span className="text-sm text-gray-800">{member.full_name} <span className="text-gray-500">({toPersianDigits(member.personnel_code)})</span></span>
                            </label>))}
                        </div>)}
                    </div>);
                }) : <p className="text-center text-gray-500 p-4">{loadingMembers ? 'در حال بارگذاری...' : 'هیچ عضو ترددی یافت نشد.'}</p>}
            </div>
            {selectedMembers.length > 0 && <button onClick={() => setSelectedMembers([])} className="text-xs text-red-600 hover:underline">پاک کردن انتخاب ({toPersianDigits(selectedMembers.length)})</button>}
        </div>
        <div>
          <button onClick={handleLogCommute} disabled={!selectedGuard || selectedMembers.length === 0} className={`w-full px-8 py-3 text-lg font-semibold text-white rounded-lg disabled:bg-gray-400 transition-all transform hover:scale-105 ${operationType === 'entry' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {operationType === 'entry' ? `ثبت ورود برای ${toPersianDigits(selectedMembers.length)} نفر` : `ثبت خروج برای ${toPersianDigits(selectedMembers.length)} نفر`}
          </button>
        </div>
      </div>
      {isEditModalOpen && editingLog && (<EditCommuteLogModal log={editingLog} guards={GUARDS} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveLog} />)}
      {isShortLeaveModalOpen && (<AddShortLeaveModal members={commutingMembers} guards={GUARDS} onClose={() => setIsShortLeaveModalOpen(false)} onSave={handleSaveShortLeave} />)}
    </div>
  );
};

export default LogCommutePage;
