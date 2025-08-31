import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteLog } from '../../types';
import { PencilIcon, SearchIcon, TrashIcon, PlusCircleIcon } from '../icons/Icons';
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
const PAGE_SIZE = 10;

const LOG_HEADER_MAP: { [key: string]: keyof Omit<CommuteLog, 'id' | 'full_name'> } = {
  'کد پرسنلی': 'personnel_code',
  'نام نگهبان': 'guard_name',
  'زمان ورود': 'entry_time',
  'زمان خروج': 'exit_time',
  'نوع تردد': 'log_type',
};
const EXPORT_HEADERS = ['کد پرسنلی', 'نام و نام خانوادگی', 'نام نگهبان', 'زمان ورود', 'زمان خروج', 'نوع تردد'];


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
  const [selectedMembers, setSelectedMembers] = useState<CommutingMember[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [manualDate, setManualDate] = useState({ year: '', month: '', day: '' });
  const [manualTime, setManualTime] = useState({ hour: '', minute: '' });

  const [searchDate, setSearchDate] = useState({ year: '', month: '', day: '' });
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(0);

  const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShortLeaveModalOpen, setIsShortLeaveModalOpen] = useState(false);

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

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
    const now = new Date();
    setManualDate(today);
    setManualTime({ 
      hour: now.getHours().toString(), 
      minute: now.getMinutes().toString() 
    });
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

  const departments = useMemo(() => {
    const allDepts = commutingMembers.map(m => m.department || 'بدون واحد');
    return [...new Set(allDepts)];
  }, [commutingMembers]);

  const membersFilteredByDept = useMemo(() => {
    if (selectedDepartments.length === 0) {
        return commutingMembers;
    }
    return commutingMembers.filter(m => selectedDepartments.includes(m.department || 'بدون واحد'));
  }, [commutingMembers, selectedDepartments]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    const selectedIds = new Set(selectedMembers.map(m => m.id));
    return membersFilteredByDept.filter(m =>
      !selectedIds.has(m.id) && (
        m.full_name.toLowerCase().includes(lowercasedTerm) ||
        m.personnel_code.includes(lowercasedTerm)
      )
    );
  }, [searchTerm, membersFilteredByDept, selectedMembers]);

  const handleToggleMember = (member: CommutingMember) => {
    setSelectedMembers(prev => {
        const isSelected = prev.some(m => m.id === member.id);
        if (isSelected) {
            return prev.filter(m => m.id !== member.id);
        } else {
            return [...prev, member];
        }
    });
    setSearchTerm('');
  };
  
  const handleToggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
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

  const handleLogEntry = async () => {
    if (!selectedGuard || selectedMembers.length === 0) {
      setStatus({ type: 'error', message: 'لطفاً نگهبان و حداقل یک پرسنل را انتخاب کنید.' });
      return;
    }
    
    const timestampOverride = getTimestampFromState();

    setStatus({ type: 'info', message: `در حال ثبت ورود برای ${toPersianDigits(selectedMembers.length)} نفر...` });
    try {
      const response = await fetch('/api/commute-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            personnelCodes: selectedMembers.map(m => m.personnel_code),
            guardName: selectedGuard,
            action: 'entry',
            timestampOverride
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'خطا در ثبت تردد');
      setStatus({ type: 'success', message: data.message});
      setSelectedMembers([]);
      setSearchTerm('');
      setSearchDate(manualDate);
      // Await fetchLogs to ensure UI updates after state change
      await fetchLogs();
      
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
    } finally {
        setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleDirectExit = async (logId: number) => {
    if (!selectedGuard) {
      setStatus({ type: 'error', message: 'لطفاً ابتدا نگهبان را در فرم سمت راست انتخاب کنید.' });
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

    const handleSaveShortLeave = async (logData: { personnelCode: string; guardName: string; leaveTime: string; returnTime: string; }) => {
        setStatus({ type: 'info', message: 'در حال ثبت تردد بین‌ساعتی...'});
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...logData, action: 'short_leave' }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'خطا در ثبت');
            setStatus({ type: 'success', message: data.message });
            setIsShortLeaveModalOpen(false);
            await fetchLogs();
        } catch(err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array', cellDates: true });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                const mappedData = json.map((row: any) => {
                    const newRow: { [key: string]: any } = {};
                    for (const header in LOG_HEADER_MAP) {
                        const key = LOG_HEADER_MAP[header];
                        const value = row[header];
                        if (value instanceof Date) {
                             newRow[key] = value.toISOString();
                        } else {
                             newRow[key] = value ? String(value) : null;
                        }
                    }
                    return newRow;
                });
                
                const response = await fetch('/api/commute-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'خطا در ورود اطلاعات');
                
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

    const handleDownloadSample = () => {
        const headers = ['کد پرسنلی', 'نام نگهبان', 'زمان ورود', 'زمان خروج', 'نوع تردد'];
        const sampleData = [
            ['1001', 'شیفت A | محسن صادقی گوغری', '2023-10-26T08:00:00', '2023-10-26T16:00:00', 'main'],
            ['1002', 'شیفت B | عباس فیروز آبادی', '2023-10-26T12:00:00', '2023-10-26T13:00:00', 'short_leave']
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData.map(row => row.map(cell => cell.toString()))]);
        ws['!cols'] = [{wch:15}, {wch:30}, {wch:25}, {wch:25}, {wch:15}];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
        XLSX.writeFile(wb, 'Sample_CommuteLogs_File.xlsx');
    };

    const handleExport = async () => {
      setStatus({type: 'info', message: 'در حال آماده‌سازی خروجی اکسل...'});
      try {
        const isoDate = dateToIsoString(searchDate);
        const params = new URLSearchParams({ pageSize: '10000', searchTerm: logSearchTerm, searchDate: isoDate });
        const response = await fetch(`/api/commute-logs?${params.toString()}`);
        if (!response.ok) throw new Error('خطا در دریافت اطلاعات برای خروجی');
        const data = await response.json();

        const dataToExport = data.logs.map((log: CommuteLog) => ({
            'کد پرسنلی': log.personnel_code,
            'نام و نام خانوادگی': log.full_name,
            'نام نگهبان': log.guard_name,
            'زمان ورود': log.entry_time ? new Date(log.entry_time).toLocaleString('fa-IR', {timeZone: 'Asia/Tehran'}) : '',
            'زمان خروج': log.exit_time ? new Date(log.exit_time).toLocaleString('fa-IR', {timeZone: 'Asia/Tehran'}) : '',
            'نوع تردد': log.log_type === 'short_leave' ? 'بین‌ساعتی' : 'اصلی',
        }));
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: EXPORT_HEADERS });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `تردد ${toPersianDigits(searchDate.year)}/${toPersianDigits(searchDate.month)}/${toPersianDigits(searchDate.day)}`);
        XLSX.writeFile(workbook, `CommuteLogs_${searchDate.year}-${searchDate.month}-${searchDate.day}.xlsx`);
        setStatus(null);
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در خروجی گرفتن' });
        setTimeout(() => setStatus(null), 5000);
      }
    };


  const formatTime = (isoString: string | null) => {
    if (!isoString) return ' - ';
    return toPersianDigits(new Date(isoString).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }));
  };

  const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {isEditModalOpen && editingLog && 
        <EditCommuteLogModal 
            log={editingLog} 
            guards={GUARDS}
            onClose={() => setIsEditModalOpen(false)} 
            onSave={handleSaveLog} 
        />
      }
      {isShortLeaveModalOpen && 
        <AddShortLeaveModal
            members={commutingMembers}
            guards={GUARDS}
            onClose={() => setIsShortLeaveModalOpen(false)}
            onSave={handleSaveShortLeave}
        />
      }
      
      {/* Right Column: Form */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-lg space-y-6 h-fit sticky top-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ثبت تردد</h2>
          <p className="text-sm text-gray-500">ورود و خروج پرسنل را در شیفت‌های مختلف ثبت کنید.</p>
        </div>
        {status && (<div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>)}
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
        <div className="p-4 border border-gray-200 rounded-lg bg-slate-50 space-y-3">
          <h4 className="font-semibold text-gray-700 text-sm">تاریخ و زمان ورود (اختیاری)</h4>
          <p className="text-xs text-gray-500">اگر خالی باشد، زمان فعلی سیستم ثبت می‌شود.</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <select value={manualDate.day} onChange={e => setManualDate(p => ({...p, day: e.target.value}))} className="md:col-span-1 p-2 border rounded-md text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
              <select value={manualDate.month} onChange={e => setManualDate(p => ({...p, month: e.target.value}))} className="md:col-span-2 p-2 border rounded-md text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
              <select value={manualDate.year} onChange={e => setManualDate(p => ({...p, year: e.target.value}))} className="md:col-span-2 p-2 border rounded-md text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
          </div>
          <div className="grid grid-cols-2 gap-2">
              <select value={manualTime.hour} onChange={e => setManualTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border rounded-md text-sm"><option value="">ساعت</option>{Array.from({length:24},(_,i)=>i).map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}</select>
              <select value={manualTime.minute} onChange={e => setManualTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border rounded-md text-sm"><option value="">دقیقه</option>{Array.from({length:60},(_,i)=>i).map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}</select>
          </div>
        </div>
        <div className="space-y-4">
            <label htmlFor="personnel-search" className="block text-sm font-medium text-gray-700">انتخاب پرسنل ({toPersianDigits(selectedMembers.length)} نفر)</label>
            
            <div className="p-3 border rounded-md bg-slate-50 space-y-2">
                <p className="text-xs font-semibold text-gray-600">فیلتر بر اساس واحد</p>
                <div className="flex flex-wrap gap-2">
                    {departments.map(dept => (
                        <label key={dept} className="flex items-center space-x-2 space-x-reverse text-xs cursor-pointer">
                            <input type="checkbox" checked={selectedDepartments.includes(dept)} onChange={() => handleToggleDepartment(dept)} className="form-checkbox h-4 w-4 text-blue-600" />
                            <span>{dept}</span>
                        </label>
                    ))}
                </div>
                 {selectedDepartments.length > 0 && <button onClick={() => setSelectedDepartments([])} className="text-xs text-red-600 hover:underline">پاک کردن فیلترها</button>}
            </div>

            <div className="relative">
              <input type="text" id="personnel-search" placeholder="جستجوی پرسنل..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} className="w-full pl-4 pr-10 py-2 border rounded-md" autoComplete="off" />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              {isSearchFocused && filteredMembers.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border shadow-lg rounded-md max-h-60 overflow-y-auto">
                  {filteredMembers.map(m => (<li key={m.id} onMouseDown={() => handleToggleMember(m)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{m.full_name} ({toPersianDigits(m.personnel_code)})</li>))}
                </ul>
              )}
            </div>
            {selectedMembers.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto p-2 border rounded-md bg-slate-50">
                    {selectedMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between bg-white p-2 rounded-md border text-sm">
                           <span>{m.full_name}</span>
                           <button onClick={() => handleToggleMember(m)} className="text-red-500 hover:text-red-700">&times;</button>
                        </div>
                    ))}
                </div>
            )}
             {selectedMembers.length > 0 && (
                 <div>
                    <button onClick={() => setSelectedMembers([])} className="text-xs text-red-600 hover:underline">پاک کردن انتخاب</button>
                    <button onClick={() => setSelectedMembers(membersFilteredByDept)} className="text-xs text-blue-600 hover:underline mr-4">انتخاب همه موارد فیلتر شده</button>
                </div>
            )}
        </div>
        <div>
          <button onClick={handleLogEntry} disabled={!selectedGuard || selectedMembers.length === 0} className="w-full px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-all transform hover:scale-105">
            ثبت ورود برای {toPersianDigits(selectedMembers.length)} نفر
          </button>
        </div>
      </div>

      {/* Left Column: Logs */}
      <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow-lg space-y-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b-2 border-gray-100 pb-4">
               <h2 className="text-2xl font-bold text-gray-800">ترددهای ثبت شده در {toPersianDigits(searchDate.day)}/{toPersianDigits(searchDate.month)}/{toPersianDigits(searchDate.year)}</h2>
               <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setIsShortLeaveModalOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    <PlusCircleIcon className="w-5 h-5"/>
                    <span>ثبت تردد بین‌ساعتی</span>
                  </button>
                  <button onClick={handleExport} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">خروجی اکسل</button>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">فیلتر تاریخ</label>
                  <div className="grid grid-cols-3 gap-2">
                      <select value={searchDate.day} onChange={e => { setSearchDate(p => ({...p, day: e.target.value})); setLogCurrentPage(1);}} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>روز</option>{DAYS.map(d => <option key={d} value={d}>{toPersianDigits(d)}</option>)}</select>
                      <select value={searchDate.month} onChange={e => { setSearchDate(p => ({...p, month: e.target.value})); setLogCurrentPage(1);}} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>ماه</option>{PERSIAN_MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}</select>
                      <select value={searchDate.year} onChange={e => { setSearchDate(p => ({...p, year: e.target.value})); setLogCurrentPage(1);}} className="w-full p-2 border border-gray-300 rounded-md text-sm"><option value="" disabled>سال</option>{YEARS.map(y => <option key={y} value={y}>{toPersianDigits(y)}</option>)}</select>
                  </div>
              </div>
              <div>
                  <label htmlFor="log-search" className="block text-sm font-medium text-gray-600 mb-1">جستجو در لیست روزانه</label>
                  <input type="text" id="log-search" placeholder="نام یا کد پرسنلی..." value={logSearchTerm} onChange={e => {setLogSearchTerm(e.target.value); setLogCurrentPage(1);}} className="w-full pl-4 py-2 border border-gray-300 rounded-md"/>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-700">ورودهای باز ({toPersianDigits(openLogs.length)})</h3>
            {openLogs.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full"><thead className="bg-amber-50"><tr>
                      <th className="px-4 py-2 text-right text-xs font-bold uppercase text-amber-800">پرسنل</th>
                      <th className="px-4 py-2 text-right text-xs font-bold uppercase text-amber-800">ورود</th>
                      <th className="px-4 py-2 text-right text-xs font-bold uppercase text-amber-800">نگهبان</th>
                      <th className="px-4 py-2 text-center text-xs font-bold uppercase text-amber-800">عملیات</th>
                </tr></thead><tbody className="bg-white divide-y divide-gray-200">
                    {openLogs.map(log => (
                      <tr key={log.id}><td className="px-4 py-2 whitespace-nowrap text-sm">{log.full_name || log.personnel_code}</td><td className="px-4 py-2 font-mono">{formatTime(log.entry_time)}</td><td>{log.guard_name}</td>
                        <td className="px-4 py-2 text-center"><button onClick={() => handleDirectExit(log.id)} disabled={!selectedGuard} className="px-3 py-1 text-sm font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 disabled:bg-gray-300">ثبت خروج</button></td>
                      </tr>
                    ))}
                </tbody></table>
              </div>
            ) : <p className="text-center py-4 text-gray-500 bg-slate-50 rounded-lg">در حال حاضر هیچ ورود بازی برای تاریخ انتخاب شده ثبت نشده است.</p>}
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-700">تاریخچه ترددهای تکمیل‌شده</h3>
             <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full"><thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">پرسنل</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">نوع</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">خروج</th>
                    <th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">ورود</th>
                    <th className="px-4 py-2 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>
                </tr></thead><tbody className="bg-white divide-y divide-gray-200">
                  {loadingLogs && <tr><td colSpan={5} className="text-center p-4">در حال بارگذاری...</td></tr>}
                  {!loadingLogs && completedLogs.length === 0 && (<tr><td colSpan={5} className="text-center p-4 text-gray-500">هیچ تردد تکمیل‌شده‌ای یافت نشد.</td></tr>)}
                  {!loadingLogs && completedLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{log.full_name || log.personnel_code}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${log.log_type === 'short_leave' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                          {log.log_type === 'short_leave' ? 'بین‌ساعتی' : 'اصلی'}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono">{formatTime(log.log_type === 'main' ? log.entry_time : log.exit_time)}</td>
                      <td className="px-4 py-2 font-mono">{formatTime(log.log_type === 'main' ? log.exit_time : log.entry_time)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                        <button onClick={() => {setEditingLog(log); setIsEditModalOpen(true);}} className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-full"><PencilIcon className="w-5 h-5"/></button>
                        <button onClick={() => handleDeleteLog(log.id)} className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full mr-2"><TrashIcon className="w-5 h-5"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody></table>
            </div>

            {!loadingLogs && !error && logTotalPages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-4">
                    <button onClick={() => setLogCurrentPage(p => Math.max(p - 1, 1))} disabled={logCurrentPage === 1} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">قبلی</button>
                    <span>{toPersianDigits(logCurrentPage)} / {toPersianDigits(logTotalPages)}</span>
                    <button onClick={() => setLogCurrentPage(p => Math.min(p + 1, logTotalPages))} disabled={logCurrentPage === logTotalPages} className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-50">بعدی</button>
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default LogCommutePage;