import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { PencilIcon, TrashIcon, ArrowRightOnRectangleIcon, ChevronDownIcon, SearchIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی',
];

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => 1403 + i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
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

const LogCommutePage: React.FC = () => {
    const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
    const [logs, setLogs] = useState<CommuteLog[]>([]);
    const [selectedGuard, setSelectedGuard] = useState<string>(GUARDS[0]);
    const [selectedPersonnel, setSelectedPersonnel] = useState<Set<string>>(new Set());
    const [personnelSearch, setPersonnelSearch] = useState('');
    const [logSearchTerm, setLogSearchTerm] = useState('');
    
    const [actionType, setActionType] = useState<'entry' | 'exit'>('entry');

    const [logDate, setLogDate] = useState({ year: '', month: '', day: '' });
    const [viewDate, setViewDate] = useState({ year: '', month: '', day: '' });
    const [entryTime, setEntryTime] = useState({ hour: '', minute: '' });
    const [exitTime, setExitTime] = useState({ hour: '', minute: '' });

    const [loadingMembers, setLoadingMembers] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());

    const getTodayPersian = useCallback(() => {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        });
        const parts = formatter.formatToParts(today);
        const year = parts.find(p => p.type === 'year')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        return { year, month, day };
    }, []);

    useEffect(() => {
        const today = getTodayPersian();
        const now = new Date();
        const currentHour = String(now.getHours());
        const currentMinute = String(now.getMinutes());

        setLogDate(today);
        setViewDate(today);
        setEntryTime({ hour: currentHour, minute: currentMinute });
        setExitTime({ hour: currentHour, minute: currentMinute });
    }, [getTodayPersian]);

    const fetchCommutingMembers = useCallback(async () => {
        try {
            setLoadingMembers(true);
            const response = await fetch('/api/commuting-members');
            if (!response.ok) throw new Error('خطا در دریافت لیست اعضای تردد');
            const data = await response.json();
            const members: CommutingMember[] = data.members || [];
            setCommutingMembers(members);
            const allUnits = new Set(members.map((m) => m.department || 'بدون واحد'));
            setOpenUnits(allUnits);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setLoadingMembers(false);
        }
    }, []);
    
    const fetchLogs = useCallback(async () => {
        if (!viewDate.year || !viewDate.month || !viewDate.day) return;
        try {
          setLoadingLogs(true);
          setError(null);
          const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(viewDate.year), parseInt(viewDate.month), parseInt(viewDate.day));
          const dateString = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
          const response = await fetch(`/api/commute-logs?date=${dateString}`);
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'خطا در دریافت ترددها');
          }
          const data = await response.json();
          setLogs(data.logs || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
          setLoadingLogs(false);
        }
      }, [viewDate]);
    
      useEffect(() => {
        fetchCommutingMembers();
      }, [fetchCommutingMembers]);
    
      useEffect(() => {
        fetchLogs();
      }, [fetchLogs]);

    const groupedMembers = useMemo(() => {
        const filtered = personnelSearch
            ? commutingMembers.filter(m =>
                m.full_name.toLowerCase().includes(personnelSearch.toLowerCase()) ||
                m.personnel_code.includes(personnelSearch)
            )
            : commutingMembers;

        const groups = filtered.reduce((acc, member) => {
            const department = member.department || 'بدون واحد';
            if (!acc[department]) {
                acc[department] = [];
            }
            acc[department].push(member);
            return acc;
        }, {} as Record<string, CommutingMember[]>);
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'fa'));
    }, [personnelSearch, commutingMembers]);

    const filteredLogs = useMemo(() => {
        if (!logSearchTerm.trim()) {
            return logs;
        }
        const lowercasedTerm = logSearchTerm.toLowerCase().trim();
        return logs.filter(log => 
            log.full_name?.toLowerCase().includes(lowercasedTerm) ||
            log.personnel_code.toLowerCase().includes(lowercasedTerm)
        );
    }, [logs, logSearchTerm]);

    const handlePersonnelToggle = (personnelCode: string) => {
        setSelectedPersonnel(prev => {
            const newSet = new Set(prev);
            newSet.has(personnelCode) ? newSet.delete(personnelCode) : newSet.add(personnelCode);
            return newSet;
        });
    };

    const handleUnitSelectionToggle = (unitPersonnel: CommutingMember[]) => {
        const unitCodes = unitPersonnel.map(p => p.personnel_code);
        const allSelectedInUnit = unitCodes.every(code => selectedPersonnel.has(code));
        setSelectedPersonnel(prev => {
            const newSet = new Set(prev);
            if (allSelectedInUnit) {
                unitCodes.forEach(code => newSet.delete(code));
            } else {
                unitCodes.forEach(code => newSet.add(code));
            }
            return newSet;
        });
    };
    
    const getTimestampOverride = (time: { hour: string, minute: string }) => {
        if (!logDate.year || !logDate.month || !logDate.day || !time.hour || !time.minute) return null;
        const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(logDate.year), parseInt(logDate.month), parseInt(logDate.day));
        const date = new Date(Date.UTC(gYear, gMonth - 1, gDay, parseInt(time.hour), parseInt(time.minute)));
        date.setMinutes(date.getMinutes() - 210); // Adjust for Iran's timezone offset
        return date.toISOString();
    };

    const handleSubmit = async () => {
        if (selectedPersonnel.size === 0) {
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل را انتخاب کنید.' });
            return;
        }
        
        const actionText = actionType === 'entry' ? 'ورود' : 'خروج';
        setStatus({ type: 'info', message: `در حال ثبت ${actionText}...` });
        
        const timestampOverride = getTimestampOverride(actionType === 'entry' ? entryTime : exitTime);
        
        let successCount = 0;
        for (const personnelCode of selectedPersonnel) {
            try {
                const response = await fetch('/api/commute-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personnelCode, guardName: selectedGuard, action: actionType, timestampOverride })
                });
                if (response.ok) {
                    successCount++;
                } else {
                    const errorData = await response.json();
                    // Optionally show individual errors, for now, we just count success
                    console.error(`Failed for ${personnelCode}:`, errorData.error);
                }
            } catch (err) {
                 console.error(`Request failed for ${personnelCode}:`, err);
            }
        }
        
        setStatus({ type: 'success', message: `${actionText} برای ${toPersianDigits(successCount)} نفر با موفقیت ثبت شد.` });
        setSelectedPersonnel(new Set());
        fetchLogs();
        setTimeout(() => setStatus(null), 5000);
    };

    const handleEditClick = (log: CommuteLog) => {
        setEditingLog(log);
        setIsEditModalOpen(true);
    };

    const handleDeleteLog = async (id: number) => {
        if (window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) {
            try {
                const response = await fetch('/api/commute-logs', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
                if (!response.ok) throw new Error((await response.json()).error);
                setStatus({ type: 'success', message: 'رکورد با موفقیت حذف شد.' });
                fetchLogs();
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
        }
    };
    
    const handleSaveLog = async (updatedLog: CommuteLog) => {
        try {
            const response = await fetch('/api/commute-logs', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedLog) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: 'رکورد با موفقیت ویرایش شد.' });
            fetchLogs();
            setIsEditModalOpen(false);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const formatTime = (isoString: string | null) => {
        if (!isoString) return '---';
        return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Column: Form */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-lg space-y-6">
          <h2 className="text-xl font-bold text-gray-800">ثبت تردد</h2>
          {status && <div className={`p-3 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">شیفت کاری</label>
              <div className="grid grid-cols-1 gap-2">
                {GUARDS.map(guard => (
                  <label key={guard} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${selectedGuard === guard ? 'bg-blue-100 border-blue-500' : 'bg-slate-50'}`}>
                    <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={e => setSelectedGuard(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500"/>
                    <span className="mr-3 text-sm">{guard}</span>
                  </label>
                ))}
              </div>
            </div>

             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع عملیات</label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200 rounded-lg">
                    <button type="button" onClick={() => setActionType('entry')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${actionType === 'entry' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                        ثبت ورود
                    </button>
                    <button type="button" onClick={() => setActionType('exit')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${actionType === 'exit' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                        ثبت خروج
                    </button>
                </div>
            </div>
            
             <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <h3 className="font-semibold">ثبت تاریخ و زمان</h3>
               <div className="grid grid-cols-3 gap-2">
                <select value={logDate.day} onChange={e => setLogDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                <select value={logDate.month} onChange={e => setLogDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                <select value={logDate.year} onChange={e => setLogDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={actionType === 'exit' ? 'opacity-50' : ''}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ساعت ورود</label>
                      <div className="grid grid-cols-2 gap-2">
                          <select value={entryTime.hour} onChange={e => setEntryTime(p => ({...p, hour: e.target.value}))} disabled={actionType === 'exit'} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                          <select value={entryTime.minute} onChange={e => setEntryTime(p => ({...p, minute: e.target.value}))} disabled={actionType === 'exit'} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                      </div>
                  </div>
                  <div className={actionType === 'entry' ? 'opacity-50' : ''}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ساعت خروج</label>
                      <div className="grid grid-cols-2 gap-2">
                          <select value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} disabled={actionType === 'entry'} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2,'0'))}</option>)}</select>
                          <select value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} disabled={actionType === 'entry'} className="w-full p-2 border border-gray-300 rounded-md font-sans"><option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2,'0'))}</option>)}</select>
                      </div>
                  </div>
              </div>
            </div>

            <div className="border rounded-lg">
                <div className="p-4 border-b">
                     <h3 className="font-semibold">انتخاب پرسنل ({toPersianDigits(selectedPersonnel.size)} نفر)</h3>
                     <input type="text" placeholder="جستجوی پرسنل..." value={personnelSearch} onChange={e => setPersonnelSearch(e.target.value)} className="w-full mt-2 p-2 border rounded-md"/>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                    {groupedMembers.map(([unit, members]) => {
                        const allInUnitSelected = members.every(m => selectedPersonnel.has(m.personnel_code));
                        return (
                            <div key={unit} className="mb-2">
                                <button onClick={() => setOpenUnits(prev => new Set(prev).add(unit))} className="w-full flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                    <div className="flex items-center">
                                        <input type="checkbox" checked={allInUnitSelected} onChange={() => handleUnitSelectionToggle(members)} className="ml-2 w-4 h-4"/>
                                        <span className="font-semibold text-sm">{unit}</span>
                                    </div>
                                    <ChevronDownIcon className="w-4 h-4" />
                                </button>
                                <div className="pr-4 mt-1 space-y-1">
                                    {members.map(member => (
                                        <label key={member.personnel_code} className="flex items-center p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" checked={selectedPersonnel.has(member.personnel_code)} onChange={() => handlePersonnelToggle(member.personnel_code)} className="ml-2 w-4 h-4"/>
                                            <div className="flex flex-col">
                                                <span className="text-sm">{member.full_name}</span>
                                                <span className="text-xs text-gray-500 font-sans tracking-wider">کد: {toPersianDigits(member.personnel_code)}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            <button onClick={handleSubmit} disabled={selectedPersonnel.size === 0} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                {actionType === 'entry' ? 'ثبت ورود' : 'ثبت خروج'} برای {toPersianDigits(selectedPersonnel.size)} نفر
            </button>
          </div>
        </div>
        
        {/* Left Column: Logs */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
             <h2 className="text-xl font-bold text-gray-800">ترددهای ثبت شده در تاریخ</h2>
             <div className="grid grid-cols-3 gap-2">
                <select value={viewDate.day} onChange={e => setViewDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans">
                    {DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}
                </select>
                <select value={viewDate.month} onChange={e => setViewDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans">
                    {PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
                <select value={viewDate.year} onChange={e => setViewDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans">
                    {YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}
                </select>
             </div>
          </div>
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="جستجو در لیست روزانه (نام یا کد پرسنلی)..."
              value={logSearchTerm}
              onChange={e => setLogSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">پرسنل</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">شیفت</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">ورود</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">خروج</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingLogs ? <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr> :
                 filteredLogs.length === 0 ? <tr><td colSpan={5} className="text-center p-4 text-gray-500">{logSearchTerm ? 'موردی با این مشخصات یافت نشد.' : 'هیچ ترددی برای این روز ثبت نشده است.'}</td></tr> :
                 filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{log.full_name}</div><div className="text-xs text-gray-500">کد: {toPersianDigits(log.personnel_code)}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.guard_name.split('|')[0]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 tabular-nums">{formatTime(log.entry_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 tabular-nums">{formatTime(log.exit_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEditClick(log)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md" title="ویرایش"><PencilIcon className="w-5 h-5" /></button>
                          <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-md" title="حذف"><TrashIcon className="w-5 h-5" /></button>
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
        <EditCommuteLogModal log={editingLog} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveLog} />
      )}
    </>
  );
};

export default LogCommutePage;