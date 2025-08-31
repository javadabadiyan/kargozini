import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { CommutingMember, CommuteLog, Personnel } from '../../types';
import EditCommuteLogModal from '../EditCommuteLogModal';
import AddShortLeaveModal from '../AddShortLeaveModal';
import { PencilIcon, SearchIcon, TrashIcon, PlusCircleIcon } from '../icons/Icons';

declare const XLSX: any;

const GUARDS = [
  'شیفت A | محسن صادقی گوغری',
  'شیفت B | عباس فیروز آبادی',
  'شیفت C | روح‌الله فخرآbادی',
];

const LOG_TYPE_MAP: { [key: string]: string } = {
  main: 'اصلی',
  short_leave: 'بین‌ساعتی',
};

const PAGE_SIZE = 15;

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatDateForAPI = (date: Date) => {
    // This function correctly formats the date regardless of client timezone
    // by creating a date based on local components but treating it as UTC.
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};


const LogCommutePage: React.FC = () => {
    const [logs, setLogs] = useState<CommuteLog[]>([]);
    const [commutingMembers, setCommutingMembers] = useState<CommutingMember[]>([]);
    const [personnelByDept, setPersonnelByDept] = useState<Record<string, CommutingMember[]>>({});

    const [loading, setLoading] = useState({ logs: true, members: true });
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    
    const [searchDate, setSearchDate] = useState(() => new Date());
    const [searchTerm, setSearchTerm] = useState('');
    
    const [operationType, setOperationType] = useState<'entry' | 'exit'>('entry');
    const [selectedPersonnelCodes, setSelectedPersonnelCodes] = useState<Set<string>>(new Set());
    const [manualTimestamp, setManualTimestamp] = useState(new Date());
    const [selectedGuard, setSelectedGuard] = useState(GUARDS[0]);
    const [personnelSearch, setPersonnelSearch] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isShortLeaveModalOpen, setIsShortLeaveModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<CommuteLog | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const showStatus = (type: 'info' | 'success' | 'error', message: string) => {
        setStatusMessage({ type, message });
        setTimeout(() => setStatusMessage(null), 5000);
    };

    const fetchLogs = useCallback(async (page: number, date: Date, search: string) => {
        setLoading(prev => ({ ...prev, logs: true }));
        try {
            const dateStr = formatDateForAPI(date);
            const response = await fetch(`/api/commute-logs?page=${page}&pageSize=${PAGE_SIZE}&searchDate=${dateStr}&searchTerm=${encodeURIComponent(search)}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'خطا در دریافت لیست تردد');
            }
            const data = await response.json();
            setLogs(data.logs || []);
            setTotalPages(Math.ceil((data.totalCount || 0) / PAGE_SIZE));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'خطای ناشناخته');
            showStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setLoading(prev => ({ ...prev, logs: false }));
        }
    }, []);

    const fetchMembers = useCallback(async () => {
        setLoading(prev => ({ ...prev, members: true }));
        try {
            const response = await fetch('/api/commuting-members');
            if (!response.ok) throw new Error('خطا در دریافت لیست اعضای تردد');
            const data = await response.json();
            const membersList: CommutingMember[] = data.members || [];
            setCommutingMembers(membersList);

            const groupedByDept = membersList.reduce((acc, member) => {
                const dept = member.department || 'بدون واحد';
                if (!acc[dept]) acc[dept] = [];
                acc[dept].push(member);
                return acc;
            }, {} as Record<string, CommutingMember[]>);
            setPersonnelByDept(groupedByDept);
        } catch (err) {
            showStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
        } finally {
            setLoading(prev => ({ ...prev, members: false }));
        }
    }, []);

    useEffect(() => {
        fetchMembers();
    }, [fetchMembers]);

    useEffect(() => {
        fetchLogs(currentPage, searchDate, searchTerm);
    }, [currentPage, searchDate, searchTerm, fetchLogs]);

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPersonnelCodes.size === 0) {
            showStatus('error', 'لطفاً حداقل یک پرسنل را انتخاب کنید.');
            return;
        }

        showStatus('info', `در حال ثبت ${operationType === 'entry' ? 'ورود' : 'خروج'}...`);
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    personnelCodes: Array.from(selectedPersonnelCodes),
                    guardName: selectedGuard,
                    action: operationType,
                    timestampOverride: manualTimestamp.toISOString(),
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'خطا در ثبت تردد');
            
            showStatus('success', result.message);
            setSelectedPersonnelCodes(new Set());
            setPersonnelSearch('');
            // Refresh logs if the action was for the currently viewed date
            if (formatDateForAPI(manualTimestamp) === formatDateForAPI(searchDate)) {
               fetchLogs(1, searchDate, searchTerm);
               if(currentPage !== 1) setCurrentPage(1);
            }
        } catch (err) {
            showStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
        }
    };
    
    const handleDelete = async (logId: number) => {
      if(window.confirm('آیا از حذف این رکورد تردد اطمینان دارید؟')) {
         showStatus('info', 'در حال حذف تردد...');
         try {
           const response = await fetch(`/api/commute-logs?id=${logId}`, { method: 'DELETE' });
           const result = await response.json();
           if (!response.ok) throw new Error(result.error || 'خطا در حذف تردد');
           showStatus('success', result.message);
           fetchLogs(currentPage, searchDate, searchTerm);
         } catch(err) {
            showStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
         }
      }
    };

    const handleSaveEdit = async (log: CommuteLog) => {
       showStatus('info', 'در حال ویرایش تردد...');
       try {
          const response = await fetch('/api/commute-logs', {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(log)
          });
          const result = await response.json();
          if(!response.ok) throw new Error(result.error || 'خطا در ویرایش تردد');
          showStatus('success', result.message);
          setIsEditModalOpen(false);
          fetchLogs(currentPage, searchDate, searchTerm);
       } catch(err) {
          showStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
       }
    };

    const handleSaveShortLeave = async (data: any) => {
        showStatus('info', 'در حال ثبت تردد بین‌ساعتی...');
        try {
            const response = await fetch('/api/commute-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, action: 'short_leave' })
            });
            const result = await response.json();
            if(!response.ok) throw new Error(result.error || 'خطا در ثبت تردد بین‌ساعتی');
            showStatus('success', result.message);
            setIsShortLeaveModalOpen(false);
            fetchLogs(currentPage, searchDate, searchTerm);
        } catch(err) {
            showStatus('error', err instanceof Error ? err.message : 'خطای ناشناخته');
        }
    };

    const handleTogglePersonnel = (code: string) => {
        const newSet = new Set(selectedPersonnelCodes);
        if (newSet.has(code)) {
            newSet.delete(code);
        } else {
            newSet.add(code);
        }
        setSelectedPersonnelCodes(newSet);
    };

    const handleSelectDept = (dept: string, select: boolean) => {
        const deptCodes = (personnelByDept[dept] || []).map(p => p.personnel_code);
        const newSet = new Set(selectedPersonnelCodes);
        if (select) {
            deptCodes.forEach(code => newSet.add(code));
        } else {
            deptCodes.forEach(code => newSet.delete(code));
        }
        setSelectedPersonnelCodes(newSet);
    };

    const filteredPersonnelByDept = useMemo(() => {
        if (!personnelSearch) return personnelByDept;
        const lowerSearch = personnelSearch.toLowerCase();
        const filtered: Record<string, CommutingMember[]> = {};
        for (const dept in personnelByDept) {
            const members = personnelByDept[dept].filter(
                m => m.full_name.toLowerCase().includes(lowerSearch) || m.personnel_code.includes(lowerSearch)
            );
            if (members.length > 0) {
                filtered[dept] = members;
            }
        }
        return filtered;
    }, [personnelByDept, personnelSearch]);

    const statusColor = {
        info: 'bg-blue-100 text-blue-800',
        success: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800'
    };
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Content: History */}
            <div className="lg:col-span-8 bg-white p-6 rounded-lg shadow-lg">
                <div className="border-b pb-4 mb-4">
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <h2 className="text-2xl font-bold text-gray-800">
                            ترددهای ثبت شده در {new Date(searchDate).toLocaleDateString('fa-IR')}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsShortLeaveModalOpen(true)} className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                                <PlusCircleIcon className="w-5 h-5" />
                                <span>تردد بین‌ساعتی</span>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" />
                            <button className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">ورود از اکسل</button>
                            <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">خروجی اکسل</button>
                        </div>
                    </div>
                     <div className="flex flex-wrap md:flex-nowrap gap-4 mt-4">
                        <input
                            type="date"
                            value={formatDateForAPI(searchDate)}
                            onChange={e => setSearchDate(new Date(e.target.value))}
                            className="p-2 border rounded-lg w-full md:w-auto"
                        />
                        <div className="relative w-full md:w-1/2">
                            <input
                                type="text"
                                placeholder="جستجوی پرسنل..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full p-2 pr-10 border rounded-lg"
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                    </div>
                </div>

                {statusMessage && (
                  <div className={`p-3 mb-4 text-sm rounded-lg ${statusColor[statusMessage.type]}`}>
                    {statusMessage.message}
                  </div>
                )}
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {['پرسنل', 'شیفت', 'ورود', 'خروج', 'نوع', 'عملیات'].map(h => 
                                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading.logs ? (
                                <tr><td colSpan={6} className="p-4 text-center">در حال بارگذاری...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={6} className="p-4 text-center text-red-500">{error}</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center text-gray-500">هیچ ترددی برای این روز ثبت نشده است.</td></tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id}>
                                        <td className="px-4 py-3 whitespace-nowrap">{log.full_name || log.personnel_code}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{log.guard_name.split('|')[0].trim()}</td>
                                        <td className="px-4 py-3 whitespace-nowrap font-mono tracking-wider">{log.entry_time ? toPersianDigits(new Date(log.entry_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit'})) : '-'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap font-mono tracking-wider">{log.exit_time ? toPersianDigits(new Date(log.exit_time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit'})) : '-'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.log_type === 'short_leave' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                {LOG_TYPE_MAP[log.log_type] || log.log_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => { setEditingLog(log); setIsEditModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900 p-1"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleDelete(log.id)} className="text-red-600 hover:text-red-900 p-1 mr-2"><TrashIcon className="w-5 h-5"/></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                 {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-4">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm border rounded disabled:opacity-50">قبلی</button>
                        <span>صفحه {toPersianDigits(currentPage)} از {toPersianDigits(totalPages)}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 text-sm border rounded disabled:opacity-50">بعدی</button>
                    </div>
                )}
            </div>

            {/* Side Form: Log Commute */}
            <div className="lg:col-span-4 bg-white p-6 rounded-lg shadow-lg h-fit sticky top-6">
                <form onSubmit={handleLogSubmit} className="space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 border-b pb-3">ثبت تردد</h3>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">نوع عملیات</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                            <button type="button" onClick={() => setOperationType('entry')} className={`px-4 py-2 rounded-md transition-colors ${operationType === 'entry' ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>ثبت ورود</button>
                            <button type="button" onClick={() => setOperationType('exit')} className={`px-4 py-2 rounded-md transition-colors ${operationType === 'exit' ? 'bg-orange-500 text-white' : 'hover:bg-gray-200'}`}>ثبت خروج</button>
                        </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">تاریخ و زمان (اختیاری)</label>
                      <input 
                        type="datetime-local" 
                        onChange={e => e.target.value && setManualTimestamp(new Date(e.target.value))}
                        className="w-full p-2 border rounded-lg"
                      />
                       <p className="text-xs text-gray-500 mt-1">اگر خالی بماند، زمان فعلی سیستم ثبت می‌شود.</p>
                    </div>

                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">شیفت کاری</label>
                        <select value={selectedGuard} onChange={e => setSelectedGuard(e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                            {GUARDS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    <div className="border-t pt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">انتخاب پرسنل ({toPersianDigits(selectedPersonnelCodes.size)} نفر)</label>
                        <input
                            type="text"
                            placeholder="جستجوی پرسنل..."
                            value={personnelSearch}
                            onChange={e => setPersonnelSearch(e.target.value)}
                            className="w-full p-2 mb-2 border rounded-lg"
                        />
                         <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                             {Object.entries(filteredPersonnelByDept).map(([dept, members]) => {
                                const isAllSelected = members.every(m => selectedPersonnelCodes.has(m.personnel_code));
                                return (
                                    <details key={dept} open={!!personnelSearch}>
                                        <summary className="cursor-pointer font-semibold text-gray-700">
                                            <input
                                                type="checkbox"
                                                className="ml-2"
                                                checked={isAllSelected}
                                                onChange={() => handleSelectDept(dept, !isAllSelected)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                            {dept}
                                        </summary>
                                        <div className="pr-4 border-r-2 mt-2 space-y-1">
                                            {members.map(member => (
                                                <div key={member.id} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        id={`cb-${member.id}`}
                                                        className="ml-2"
                                                        checked={selectedPersonnelCodes.has(member.personnel_code)}
                                                        onChange={() => handleTogglePersonnel(member.personnel_code)}
                                                    />
                                                    <label htmlFor={`cb-${member.id}`} className="text-sm">{member.full_name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    </div>

                    <button type="submit" className={`w-full py-3 text-white font-semibold rounded-lg transition-colors ${operationType === 'entry' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}`} disabled={selectedPersonnelCodes.size === 0}>
                        ثبت {operationType === 'entry' ? 'ورود' : 'خروج'} برای {toPersianDigits(selectedPersonnelCodes.size)} نفر
                    </button>
                </form>
            </div>
             {isEditModalOpen && editingLog && (
                <EditCommuteLogModal
                    log={editingLog}
                    guards={GUARDS}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveEdit}
                />
            )}
            {isShortLeaveModalOpen && (
                <AddShortLeaveModal
                    members={commutingMembers}
                    guards={GUARDS}
                    onClose={() => setIsShortLeaveModalOpen(false)}
                    onSave={handleSaveShortLeave}
                />
            )}
        </div>
    );
};

export default LogCommutePage;
