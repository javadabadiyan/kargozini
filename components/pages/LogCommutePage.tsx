import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { PencilIcon, TrashIcon, PlusCircleIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';
import AddShortLeaveModal from '../AddShortLeaveModal';

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآبادی',
];

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 622 - 5 + i); // Centered around current Jalali year
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const jalaliToGregorian = (jy: number, jm: number, jd: number): [number, number, number] => {
    // This is a simplified conversion and may have inaccuracies. For production apps, a robust library is recommended.
    let sal_a, gy, gm, gd, j_day_no;
    sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    gy = jy + 621;
    let leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
    if (leap) sal_a[2] = 29;
    if (jm <= 6) {
        j_day_no = (jm - 1) * 31 + jd;
    } else {
        j_day_no = 186 + (jm - 7) * 30 + jd;
    }
    if (j_day_no > 79) {
        j_day_no -= 79;
        if (leap) j_day_no++;
    } else {
        gy--;
        j_day_no += 286;
        leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
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
    const [unitFilter, setUnitFilter] = useState('all');
    
    const [actionType, setActionType] = useState<'entry' | 'exit'>('entry');

    const [viewDate, setViewDate] = useState({ year: '', month: '', day: '' });
    
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [isShortLeaveModalOpen, setIsShortLeaveModalOpen] = useState(false);
    const [personnelForShortLeave, setPersonnelForShortLeave] = useState<CommutingMember | null>(null);

    const getTodayPersian = useCallback(() => {
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = formatter.formatToParts(new Date());
        return {
            year: parts.find(p => p.type === 'year')?.value || '',
            month: parts.find(p => p.type === 'month')?.value || '',
            day: parts.find(p => p.type === 'day')?.value || ''
        };
    }, []);

    useEffect(() => {
        setViewDate(getTodayPersian());
    }, [getTodayPersian]);

    const fetchCommutingMembers = useCallback(async () => {
        try {
            const response = await fetch('/api/commuting-members');
            if (!response.ok) throw new Error('خطا در دریافت لیست اعضای تردد');
            const data = await response.json();
            setCommutingMembers(data.members || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'خطای ناشناخته');
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
          if (!response.ok) throw new Error((await response.json()).error);
          const data = await response.json();
          setLogs(data.logs || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
          setLoadingLogs(false);
        }
    }, [viewDate]);
    
    useEffect(() => { fetchCommutingMembers(); }, [fetchCommutingMembers]);
    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const uniqueUnits = useMemo(() => ['all', ...Array.from(new Set(commutingMembers.map(m => m.department || 'بدون واحد')))], [commutingMembers]);

    const groupedMembers = useMemo(() => {
        const filteredByUnit = unitFilter === 'all' 
            ? commutingMembers 
            : commutingMembers.filter(m => (m.department || 'بدون واحد') === unitFilter);

        const filteredBySearch = personnelSearch
            ? filteredByUnit.filter(m => m.full_name.toLowerCase().includes(personnelSearch.toLowerCase()) || m.personnel_code.includes(personnelSearch))
            : filteredByUnit;

        const groups = filteredBySearch.reduce((acc, member) => {
            const department = member.department || 'بدون واحد';
            if (!acc[department]) acc[department] = [];
            acc[department].push(member);
            return acc;
        }, {} as Record<string, CommutingMember[]>);
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'fa'));
    }, [personnelSearch, commutingMembers, unitFilter]);

    const handlePersonnelToggle = (personnelCode: string) => {
        setSelectedPersonnel(prev => {
            const newSet = new Set(prev);
            newSet.has(personnelCode) ? newSet.delete(personnelCode) : newSet.add(personnelCode);
            return newSet;
        });
    };
    
    const handleUnitSelectionToggle = (unitPersonnel: CommutingMember[]) => {
        const unitCodes = unitPersonnel.map(p => p.personnel_code);
        const allSelectedInUnit = unitCodes.length > 0 && unitCodes.every(code => selectedPersonnel.has(code));
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
    
    const handleSubmit = async () => {
        if (selectedPersonnel.size === 0 || !selectedGuard) {
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل و شیفت نگهبانی را انتخاب کنید.' });
            return;
        }
        setStatus({ type: 'info', message: `در حال ثبت ${actionType === 'entry' ? 'ورود' : 'خروج'} برای ${toPersianDigits(selectedPersonnel.size)} نفر...` });
        
        const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(viewDate.year), parseInt(viewDate.month), parseInt(viewDate.day));
        const dateStr = `${gYear}-${String(gMonth).padStart(2,'0')}-${String(gDay).padStart(2,'0')}`;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;
        // Create date in local timezone, then get ISO string which will be in UTC
        const timestamp = new Date(`${dateStr}T${timeStr}`).toISOString();

        const requests = Array.from(selectedPersonnel).map(personnelCode => 
            fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionType, personnelCode, guardName: selectedGuard, timestampOverride: timestamp }),
            })
        );
        try {
            const responses = await Promise.all(requests);
            const results = await Promise.all(responses.map(res => res.json().catch(() => ({ error: 'پاسخ نامعتبر' }))));
            const successes = results.filter(r => r.message);
            const failures = results.filter(r => r.error);
            if (failures.length > 0) {
                const errorSummary = [...new Set(failures.map(f => f.error))].join('، ');
                setStatus({ type: 'error', message: `عملیات برای ${toPersianDigits(failures.length)} نفر با خطا مواجه شد: ${errorSummary}` });
            } else {
                setStatus({ type: 'success', message: `${actionType === 'entry' ? 'ورود' : 'خروج'} برای ${toPersianDigits(successes.length)} نفر با موفقیت ثبت شد.` });
            }
            setSelectedPersonnel(new Set());
            await fetchLogs();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای کلی در ارسال درخواست‌ها.' });
        } finally {
            setTimeout(() => setStatus(null), 8000);
        }
    };

    const handleEditClick = (log: CommuteLog) => { setEditingLog(log); setIsEditModalOpen(true); };
    
    const handleDeleteLog = async (id: number) => {
        if (!window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) return;
        setStatus({ type: 'info', message: 'در حال حذف رکورد...' });
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در حذف');
            setStatus({ type: 'success', message: 'رکورد با موفقیت حذف شد.' });
            await fetchLogs();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleSaveLog = async (updatedLog: CommuteLog) => {
        setStatus({ type: 'info', message: 'در حال ذخیره تغییرات...' });
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLog),
            });
            if (!response.ok) throw new Error((await response.json()).error || 'خطا در ذخیره');
            setStatus({ type: 'success', message: 'تغییرات با موفقیت ذخیره شد.' });
            setIsEditModalOpen(false);
            setEditingLog(null);
            await fetchLogs();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleOpenShortLeaveModal = (personnelCode: string) => {
        const member = commutingMembers.find(m => m.personnel_code === personnelCode);
        if (member) {
            setPersonnelForShortLeave(member);
            setIsShortLeaveModalOpen(true);
        }
    };

    const handleSaveShortLeave = async (leaveData: { exitTime: string, returnTime: string }) => {
        if (!personnelForShortLeave) return;
        setStatus({ type: 'info', message: 'در حال ثبت تردد بین‌ساعتی...' });
        try {
            const [gYear, gMonth, gDay] = jalaliToGregorian(parseInt(viewDate.year), parseInt(viewDate.month), parseInt(viewDate.day));
            const dateStr = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
            const exitDate = new Date(`${dateStr}T${leaveData.exitTime}:00.000Z`);
            const returnDate = new Date(`${dateStr}T${leaveData.returnTime}:00.000Z`);

            const payload = {
                action: 'short_leave',
                personnelCode: personnelForShortLeave.personnel_code,
                guardName: selectedGuard,
                exitTime: exitDate.toISOString(),
                returnTime: returnDate.toISOString(),
            };
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error((await response.json()).error);
            setStatus({ type: 'success', message: 'تردد بین‌ساعتی با موفقیت ثبت شد.' });
            fetchLogs();
            setIsShortLeaveModalOpen(false);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    // FIX: Implement formatTime to return a string, resolving the 'void' is not assignable to 'ReactNode' error.
    const formatTime = (isoString: string | null): string => {
        if (!isoString) return '—';
        try {
            return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran', hour12: false
            }));
        } catch (e) {
            return 'نامعتبر';
        }
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
    <>
      {status && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`} role="alert">
          {status.message}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">پرسنل</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نوع / شیفت</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">ورود</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">خروج</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingLogs ? <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr> :
                 logs.length === 0 ? <tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ ترددی برای این روز ثبت نشده است.</td></tr> :
                 logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{log.full_name}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {log.log_type === 'short_leave' ? 
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">بین‌ساعتی</span> : 
                          log.guard_name.split('|')[0]
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 tabular-nums">{formatTime(log.entry_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 tabular-nums">{formatTime(log.exit_time)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleOpenShortLeaveModal(log.personnel_code)} className="p-2 text-green-600 hover:bg-green-100 rounded-md" title="ثبت تردد بین ساعتی"><PlusCircleIcon className="w-5 h-5" /></button>
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
        <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-lg space-y-6">
          <h2 className="text-xl font-bold text-gray-800">ثبت تردد</h2>
            <div>
              <label htmlFor="guard-select" className="block text-sm font-medium text-gray-700 mb-1">انتخاب شیفت نگهبانی</label>
              <select id="guard-select" value={selectedGuard} onChange={e => setSelectedGuard(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50">
                  {GUARDS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="border rounded-lg">
                <div className="p-4 border-b">
                     <h3 className="font-semibold">انتخاب پرسنل ({toPersianDigits(selectedPersonnel.size)} نفر)</h3>
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)} className="p-2 border rounded-md bg-slate-50">
                            {uniqueUnits.map(unit => <option key={unit} value={unit}>{unit === 'all' ? 'همه واحدها' : unit}</option>)}
                        </select>
                        <input type="text" placeholder="جستجوی پرسنل..." value={personnelSearch} onChange={e => setPersonnelSearch(e.target.value)} className="p-2 border rounded-md"/>
                     </div>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                    {groupedMembers.map(([unit, members]) => {
                        const allInUnitSelected = members.length > 0 && members.every(m => selectedPersonnel.has(m.personnel_code));
                        return (
                            <div key={unit} className="mb-2">
                                <div className="w-full flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                    <div className="flex items-center">
                                        <input type="checkbox" checked={allInUnitSelected} onChange={() => handleUnitSelectionToggle(members)} className="ml-2 w-4 h-4"/>
                                        <span className="font-semibold text-sm">{unit}</span>
                                    </div>
                                </div>
                                <div className="pr-4 mt-1 space-y-1">
                                    {members.map(member => (
                                        <label key={member.personnel_code} className="flex items-center p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" checked={selectedPersonnel.has(member.personnel_code)} onChange={() => handlePersonnelToggle(member.personnel_code)} className="ml-2 w-4 h-4"/>
                                            <div className="flex flex-col"><span className="text-sm">{member.full_name}</span></div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-1">
                <button onClick={() => setActionType('entry')} className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${actionType === 'entry' ? 'bg-blue-600 text-white shadow' : 'text-gray-600'}`}>ثبت ورود</button>
                <button onClick={() => setActionType('exit')} className={`w-1/2 p-2 rounded-md text-sm font-semibold transition-colors ${actionType === 'exit' ? 'bg-green-600 text-white shadow' : 'text-gray-600'}`}>ثبت خروج</button>
            </div>
            <button onClick={handleSubmit} disabled={selectedPersonnel.size === 0} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-transform transform hover:scale-105 disabled:scale-100">
                ثبت {actionType === 'entry' ? 'ورود' : 'خروج'} برای {toPersianDigits(selectedPersonnel.size)} نفر
            </button>
        </div>
      </div>
      {isEditModalOpen && editingLog && (<EditCommuteLogModal log={editingLog} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveLog} />)}
      {isShortLeaveModalOpen && personnelForShortLeave && (
        <AddShortLeaveModal
            personnel={personnelForShortLeave}
            guardName={selectedGuard}
            onClose={() => setIsShortLeaveModalOpen(false)}
            onSave={handleSaveShortLeave}
        />
      )}
    </>
  );
};

export default LogCommutePage;
