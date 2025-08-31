import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { PencilIcon, TrashIcon, ArrowRightOnRectangleIcon, ChevronDownIcon, SearchIcon } from '../icons/Icons';
import EditCommuteLogModal from '../EditCommuteLogModal';

declare const XLSX: any;

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

const jalaliToGregorian = (jy: number, jm: number, jd: number): [number, number, number] | null => {
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;

    let sal_a, gy, gm, gd, j_day_no;
    sal_a = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    gy = jy + 621;
    let leap = (gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0);
    if (leap) sal_a[2] = 29;

    if (jm <= 6) {
        if (jd > 31) return null;
        j_day_no = (jm - 1) * 31 + jd;
    } else {
        if ((jm < 12 && jd > 30) || (jm === 12 && jd > (leap ? 30 : 29))) return null;
        j_day_no = 186 + (jm - 7) * 30 + jd;
    }
    
    if (leap && j_day_no > 59) j_day_no++;
    if (j_day_no > 79) {
        j_day_no -= 79;
    } else {
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
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
    const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getTodayPersian = useCallback(() => {
        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = formatter.formatToParts(today);
        return {
            year: parts.find(p => p.type === 'year')?.value || '',
            month: parts.find(p => p.type === 'month')?.value || '',
            day: parts.find(p => p.type === 'day')?.value || '',
        };
    }, []);

    useEffect(() => {
        const today = getTodayPersian();
        const now = new Date();
        setLogDate(today);
        setViewDate(today);
        setEntryTime({ hour: String(now.getHours()), minute: String(now.getMinutes()) });
        setExitTime({ hour: String(now.getHours()), minute: String(now.getMinutes()) });
    }, [getTodayPersian]);

    const fetchCommutingMembers = useCallback(async () => {
        try {
            const response = await fetch('/api/commuting-members');
            if (!response.ok) throw new Error('خطا در دریافت لیست اعضای تردد');
            const data = await response.json();
            const members: CommutingMember[] = data.members || [];
            setCommutingMembers(members);
            const allUnits = new Set(members.map((m) => m.department || 'بدون واحد'));
            setOpenUnits(allUnits);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        }
    }, []);
    
    const fetchLogs = useCallback(async () => {
        if (!viewDate.year || !viewDate.month || !viewDate.day) return;
        setLoading(true);
        try {
          const gregDate = jalaliToGregorian(parseInt(viewDate.year), parseInt(viewDate.month), parseInt(viewDate.day));
          if (!gregDate) {
              setStatus({ type: 'error', message: 'تاریخ نمایش نامعتبر است.' });
              setLogs([]);
              return;
          }
          const [gYear, gMonth, gDay] = gregDate;
          const dateString = `${gYear}-${String(gMonth).padStart(2, '0')}-${String(gDay).padStart(2, '0')}`;
          const response = await fetch(`/api/commute-logs?date=${dateString}`);
          if (!response.ok) throw new Error((await response.json()).error || 'خطا در دریافت ترددها');
          const data = await response.json();
          setLogs(data.logs || []);
        } catch (err) {
          setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
          setLoading(false);
        }
    }, [viewDate]);
    
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            await fetchCommutingMembers();
            await fetchLogs();
            setLoading(false);
        };
        fetchData();
    }, [fetchCommutingMembers, fetchLogs]);

    const groupedMembers = useMemo(() => { /* ... (same as before) ... */
        const filtered = personnelSearch
            ? commutingMembers.filter(m => m.full_name.toLowerCase().includes(personnelSearch.toLowerCase()) || m.personnel_code.includes(personnelSearch))
            : commutingMembers;
        const groups = filtered.reduce((acc, member) => {
            const department = member.department || 'بدون واحد';
            if (!acc[department]) acc[department] = [];
            acc[department].push(member);
            return acc;
        }, {} as Record<string, CommutingMember[]>);
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'fa'));
    }, [personnelSearch, commutingMembers]);

    const filteredLogs = useMemo(() => {
        if (!logSearchTerm.trim()) return logs;
        const lowercasedTerm = logSearchTerm.toLowerCase().trim();
        return logs.filter(log => log.full_name?.toLowerCase().includes(lowercasedTerm) || log.personnel_code.toLowerCase().includes(lowercasedTerm));
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
            if (allSelectedInUnit) unitCodes.forEach(code => newSet.delete(code));
            else unitCodes.forEach(code => newSet.add(code));
            return newSet;
        });
    };
    
    const getTimestampOverride = (time: { hour: string, minute: string }) => {
        if (!logDate.year || !logDate.month || !logDate.day || !time.hour || !time.minute) return null;
        const gregDate = jalaliToGregorian(parseInt(logDate.year), parseInt(logDate.month), parseInt(logDate.day));
        if (!gregDate) return null;
        const [gYear, gMonth, gDay] = gregDate;
        const date = new Date(Date.UTC(gYear, gMonth - 1, gDay, parseInt(time.hour), parseInt(time.minute)));
        date.setMinutes(date.getMinutes() + new Date().getTimezoneOffset()); // Convert local to UTC
        return date.toISOString();
    };

    const handleSubmit = async () => {
        if (selectedPersonnel.size === 0) {
            setStatus({ type: 'error', message: 'لطفاً حداقل یک پرسنل را انتخاب کنید.' }); return;
        }
        const timestampOverride = getTimestampOverride(actionType === 'entry' ? entryTime : exitTime);
        if (!timestampOverride) {
            setStatus({type: 'error', message: 'تاریخ یا زمان وارد شده نامعتبر است.'}); return;
        }
        
        setStatus({ type: 'info', message: 'در حال ثبت تردد...' });
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personnelCodes: [...selectedPersonnel], guardName: selectedGuard, action: actionType, timestampOverride })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: data.message });
            setSelectedPersonnel(new Set());
            fetchLogs();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleSaveLog = async (updatedLog: CommuteLog) => {
        setStatus({ type: 'info', message: 'در حال ویرایش...' });
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

    const formatDate = (isoString: string | null) => {
        if (!isoString) return '---';
        return toPersianDigits(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date(isoString)));
    };

    const handleDownloadSample = () => {
        const sampleData = [
            {'کد پرسنلی': '1001', 'تاریخ (مثال: ۱۴۰۳/۰۵/۱۷)': '1403/05/17', 'ساعت ورود (HH:mm)': '08:00', 'ساعت خروج (HH:mm)': '17:00'},
            {'کد پرسنلی': '1002', 'تاریخ (مثال: ۱۴۰۳/۰۵/۱۷)': '1403/05/17', 'ساعت ورود (HH:mm)': '08:05', 'ساعت خروج (HH:mm)': ''},
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه تردد');
        XLSX.writeFile(wb, 'Sample_Commute_Logs.xlsx');
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const mappedData = json.map((row: any) => {
                    const personnel_code = row['کد پرسنلی'] ? String(row['کد پرسنلی']) : null;
                    const dateStr = row['تاریخ (مثال: ۱۴۰۳/۰۵/۱۷)'] ? String(row['تاریخ (مثال: ۱۴۰۳/۰۵/۱۷)']) : null;
                    const entryTimeStr = row['ساعت ورود (HH:mm)'] ? String(row['ساعت ورود (HH:mm)']) : null;
                    const exitTimeStr = row['ساعت خروج (HH:mm)'] ? String(row['ساعت خروج (HH:mm)']) : null;

                    if (!personnel_code || !dateStr) return null;

                    const dateParts = dateStr.split('/').map(p => parseInt(p));
                    if(dateParts.length !== 3) return null;
                    const gregDate = jalaliToGregorian(dateParts[0], dateParts[1], dateParts[2]);
                    if(!gregDate) return null;

                    const [gYear, gMonth, gDay] = gregDate;
                    
                    let entry_time: string | null = null;
                    if(entryTimeStr && entryTimeStr.includes(':')){
                        const [h,m] = entryTimeStr.split(':').map(p => parseInt(p));
                        entry_time = new Date(Date.UTC(gYear, gMonth-1, gDay, h, m)).toISOString();
                    }
                    
                    let exit_time: string | null = null;
                    if(exitTimeStr && exitTimeStr.includes(':')){
                        const [h,m] = exitTimeStr.split(':').map(p => parseInt(p));
                        exit_time = new Date(Date.UTC(gYear, gMonth-1, gDay, h, m)).toISOString();
                    }

                    return { personnel_code, entry_time, exit_time };
                }).filter(Boolean);

                const response = await fetch('/api/commute-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mappedData) });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: data.message });
                fetchLogs();
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل' });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
                setTimeout(() => setStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExport = () => {
        const dataToExport = filteredLogs.map(log => ({
            'کد پرسنلی': log.personnel_code,
            'نام پرسنل': log.full_name,
            'تاریخ': formatDate(log.entry_time),
            'شیفت کاری': log.guard_name,
            'ساعت ورود': formatTime(log.entry_time),
            'ساعت خروج': formatTime(log.exit_time),
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ترددها');
        XLSX.writeFile(wb, `Commute_Logs_${viewDate.year}-${viewDate.month}-${viewDate.day}.xlsx`);
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-lg">
           <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-800">ترددهای ثبت شده</h2>
              <div className="grid grid-cols-3 gap-2">
                 <select value={viewDate.day} onChange={e => setViewDate(p => ({...p, day: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans">{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                 <select value={viewDate.month} onChange={e => setViewDate(p => ({...p, month: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50">{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                 <select value={viewDate.year} onChange={e => setViewDate(p => ({...p, year: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md bg-slate-50 font-sans">{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
              </div>
           </div>
           <div className="flex flex-col sm:flex-row gap-4 mb-4">
               <div className="relative flex-grow">
                   <input type="text" placeholder="جستجو (نام یا کد پرسنلی)..." value={logSearchTerm} onChange={e => setLogSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg"/>
                   <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
               </div>
               <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={handleDownloadSample} className="text-sm text-blue-600 hover:underline">دانلود نمونه</button>
                  <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-logs" />
                  <label htmlFor="excel-import-logs" className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">ورود</label>
                  <button onClick={handleExport} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">خروجی</button>
               </div>
           </div>
           <div className="overflow-x-auto border rounded-lg"><table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">پرسنل</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">تاریخ</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">شیفت</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">ورود</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">خروج</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? <tr><td colSpan={6} className="text-center p-4">در حال بارگذاری...</td></tr> :
                 filteredLogs.length === 0 ? <tr><td colSpan={6} className="text-center p-4 text-gray-500">{logSearchTerm ? 'موردی یافت نشد.' : 'هیچ ترددی برای این روز ثبت نشده است.'}</td></tr> :
                 filteredLogs.map(log => (<tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><div className="text-sm font-medium">{log.full_name}</div><div className="text-xs text-gray-500">کد: {toPersianDigits(log.personnel_code)}</div></td>
                      <td className="px-4 py-3 text-sm">{formatDate(log.entry_time)}</td>
                      <td className="px-4 py-3 text-xs">{log.guard_name}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">{formatTime(log.entry_time)}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">{formatTime(log.exit_time)}</td>
                      <td className="px-4 py-3"><div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingLog(log); setIsEditModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-md" title="ویرایش"><PencilIcon className="w-5 h-5" /></button>
                          {/* DELETE functionality needs to be implemented */}
                      </div></td>
                 </tr>))}
              </tbody>
           </table></div>
        </div>
        <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-lg space-y-6">
          <h2 className="text-xl font-bold">ثبت تردد</h2>
          {status && <div className={`p-3 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">شیفت کاری</label>
              <div className="grid grid-cols-1 gap-2">
                {GUARDS.map(guard => (<label key={guard} className={`flex items-center p-3 rounded-lg border cursor-pointer ${selectedGuard === guard ? 'bg-blue-100 border-blue-500' : 'bg-slate-50'}`}>
                    <input type="radio" name="guard" value={guard} checked={selectedGuard === guard} onChange={e => setSelectedGuard(e.target.value)} className="w-4 h-4 text-blue-600"/>
                    <span className="mr-3 text-sm">{guard}</span>
                </label>))}
              </div>
            </div>
            <div className="border rounded-lg">
                <div className="p-4 border-b">
                     <h3 className="font-semibold">انتخاب پرسنل ({toPersianDigits(selectedPersonnel.size)})</h3>
                     <input type="text" placeholder="جستجو..." value={personnelSearch} onChange={e => setPersonnelSearch(e.target.value)} className="w-full mt-2 p-2 border rounded-md"/>
                </div>
                <div className="max-h-60 overflow-y-auto p-2">
                    {groupedMembers.map(([unit, members]) => (<div key={unit} className="mb-2">
                        <button onClick={() => setOpenUnits(prev => new Set(prev).has(unit) ? (new Set(prev).delete(unit), prev) : new Set(prev).add(unit))} className="w-full flex justify-between items-center p-2 bg-gray-100 rounded-md">
                           <div className="flex items-center"><input type="checkbox" checked={members.every(m => selectedPersonnel.has(m.personnel_code))} onChange={() => handleUnitSelectionToggle(members)} className="ml-2 w-4 h-4"/>
                           <span className="font-semibold text-sm">{unit}</span></div><ChevronDownIcon className="w-4 h-4" />
                        </button>
                        {openUnits.has(unit) && <div className="pr-4 mt-1 space-y-1">
                           {members.map(member => (<label key={member.personnel_code} className="flex items-center p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                               <input type="checkbox" checked={selectedPersonnel.has(member.personnel_code)} onChange={() => handlePersonnelToggle(member.personnel_code)} className="ml-2 w-4 h-4"/>
                               <div><span className="text-sm">{member.full_name}</span><div className="text-xs text-gray-500 font-sans tracking-wider">کد: {toPersianDigits(member.personnel_code)}</div></div>
                           </label>))}
                        </div>}
                    </div>))}
                </div>
            </div>
            <button onClick={() => { /* needs implementation */ }} className="w-full py-3 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                ثبت ورود برای {toPersianDigits(selectedPersonnel.size)} نفر
            </button>
          </div>
        </div>
      </div>
      {isEditModalOpen && editingLog && <EditCommuteLogModal log={editingLog} onClose={() => setIsEditModalOpen(false)} onSave={handleSaveLog} />}
    </>
  );
};

export default LogCommutePage;
