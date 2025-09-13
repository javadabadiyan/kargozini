import React, { useState, useEffect, useRef } from 'react';
import type { CommutingMember } from '../../types';
import AddCommutingMemberModal from '../AddCommutingMemberModal';

declare const XLSX: any;

const HEADER_MAP: { [key: string]: keyof Omit<CommutingMember, 'id'> } = {
  'نام و نام خانوادگی': 'full_name',
  'کد پرسنلی': 'personnel_code',
  'واحد': 'department',
  'سمت': 'position',
};

const TABLE_HEADERS = Object.keys(HEADER_MAP);

const CommutingMembersPage: React.FC = () => {
  const [members, setMembers] = useState<CommutingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/personnel?type=commuting_members');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'خطا در دریافت اطلاعات');
      }
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([TABLE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
    XLSX.writeFile(wb, 'Sample_Commuting_Members.xlsx');
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        const json: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        const mappedData = json.map((originalRow: any) => {
            const row: { [key: string]: any } = {};
            for (const key in originalRow) {
                if (Object.prototype.hasOwnProperty.call(originalRow, key)) {
                    const normalizedKey = key.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
                    row[normalizedKey] = originalRow[key];
                }
            }

            const newRow: Partial<Omit<CommutingMember, 'id'>> = {};
            for (const header in HEADER_MAP) {
                if (row.hasOwnProperty(header)) {
                    const dbKey = HEADER_MAP[header as keyof typeof HEADER_MAP];
                    let value = row[header];
                    if (typeof value === 'string') {
                        value = value.replace(/[\u0000-\u001F\u200B-\u200D\u200E\u200F\uFEFF]/g, '').trim();
                    }
                    (newRow as any)[dbKey] = (value === null || value === undefined) ? null : String(value);
                }
            }
            return newRow as Omit<CommutingMember, 'id'>;
        });

        const validData = mappedData.filter(m => m.personnel_code && m.full_name);
        if (validData.length === 0) {
            throw new Error("هیچ رکورد معتبری یافت نشد. از وجود ستون‌های 'نام و نام خانوادگی' و 'کد پرسنلی' اطمینان حاصل کنید.");
        }

        const response = await fetch('/api/personnel?type=commuting_members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validData),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'خطا در ورود اطلاعات');
        }
        
        setStatus({ type: 'success', message: 'اطلاعات با موفقیت وارد شد.' });
        fetchMembers();
      } catch (err) {
        setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل' });
      } finally {
        if(fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setStatus(null), 5000);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleExport = () => {
    const dataToExport = members.map(m => {
        const row: { [key: string]: any } = {};
        for(const header of TABLE_HEADERS){
            const key = HEADER_MAP[header as keyof typeof HEADER_MAP];
            row[header] = toPersianDigits(m[key]);
        }
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Commuting Members');
    XLSX.writeFile(workbook, 'Commuting_Members_List.xlsx');
  };

  const handleSaveNewMember = async (member: Omit<CommutingMember, 'id'>) => {
    try {
      const response = await fetch('/api/personnel?type=commuting_members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'خطا در ذخیره اطلاعات');
      }
      setStatus({ type: 'success', message: 'عضو جدید با موفقیت اضافه شد.' });
      setIsAddModalOpen(false);
      fetchMembers();
    } catch (err) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره' });
    } finally {
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const statusColor = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800'
  };

  return (
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">کارمندان عضو تردد</h2>
        <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">افزودن دستی</button>
            <button onClick={handleDownloadSample} className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200">دانلود نمونه</button>
            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-commuting" />
            <label htmlFor="excel-import-commuting" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">بازیابی از فایل</label>
            <button onClick={handleExport} disabled={members.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">تهیه پشتیبان</button>
        </div>
      </div>
      
      {status && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 border dark:border-slate-700">
          <thead className="bg-gray-100 dark:bg-slate-700/50">
            <tr>{TABLE_HEADERS.map(h => <th key={h} className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">{h}</th>)}</tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800/50 divide-y divide-gray-200 dark:divide-slate-700">
            {loading && <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4">در حال بارگذاری...</td></tr>}
            {error && <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-red-500">{error}</td></tr>}
            {!loading && !error && members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                {TABLE_HEADERS.map(header => (
                  <td key={header} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-300">
                    {toPersianDigits(m[HEADER_MAP[header as keyof typeof HEADER_MAP]])}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && !error && members.length === 0 && (
              <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-gray-500">هیچ عضوی یافت نشد.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {isAddModalOpen && <AddCommutingMemberModal onClose={() => setIsAddModalOpen(false)} onSave={handleSaveNewMember} />}
    </div>
  );
};

export default CommutingMembersPage;