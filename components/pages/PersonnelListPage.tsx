import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Personnel } from '../../types';
import EditPersonnelModal from '../EditPersonnelModal';
import { PencilIcon, SearchIcon } from '../icons/Icons';

// Type alias for SheetJS, assuming it's loaded from a global script
declare const XLSX: any;

const HEADER_MAP: { [key: string]: keyof Omit<Personnel, 'id'> } = {
  'کد پرسنلی': 'personnel_code',
  'نام': 'first_name',
  'نام خانوادگی': 'last_name',
  'نام پدر': 'father_name',
  'کد ملی': 'national_id',
  'شماره شناسنامه': 'id_number',
  'تاریخ تولد': 'birth_date',
  'محل تولد': 'birth_place',
  'تاریخ صدور': 'issue_date',
  'محل صدور': 'issue_place',
  'وضعیت تاهل': 'marital_status',
  'وضعیت نظام وظیفه': 'military_status',
  'شغل': 'job_title',
  'سمت': 'position',
  'نوع استخدام': 'employment_type',
  'واحد': 'department',
  'محل خدمت': 'service_location',
  'تاریخ استخدام': 'hire_date',
  'مدرک تحصیلی': 'education_level',
  'رشته تحصیلی': 'field_of_study',
  'وضعیت': 'status',
};

const EXPORT_HEADERS = Object.keys(HEADER_MAP);
const TABLE_HEADERS = [...EXPORT_HEADERS, 'عملیات'];

const PersonnelListPage: React.FC = () => {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/personnel');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'خطا در دریافت اطلاعات از سرور';
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch (e) {
           errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      setPersonnelList(data.personnel || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonnel();
  }, []);
  
  const filteredPersonnel = useMemo(() => {
    if (!searchTerm) {
      return personnelList;
    }
    const lowercasedFilter = searchTerm.toLowerCase().trim();
    if (!lowercasedFilter) return personnelList;

    return personnelList.filter(p =>
      String(p.first_name ?? '').toLowerCase().includes(lowercasedFilter) ||
      String(p.last_name ?? '').toLowerCase().includes(lowercasedFilter) ||
      String(p.personnel_code ?? '').toLowerCase().includes(lowercasedFilter) ||
      String(p.national_id ?? '').toLowerCase().includes(lowercasedFilter)
    );
  }, [personnelList, searchTerm]);

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Fix: Changed UintArray to Uint8Array, which is the correct type.
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const mappedData = json.map(row => {
          const newRow: { [key in keyof Omit<Personnel, 'id'>]?: string | null } = {};
          // Iterate over our defined headers to ensure all fields are considered
          for (const header in HEADER_MAP) {
            const dbKey = HEADER_MAP[header];
            const value = row[header]; // XLSX uses header names as keys
            
            // Set to null if value is null, undefined, or an empty string
            newRow[dbKey] = (value === null || value === undefined || String(value).trim() === '') 
              ? null 
              : String(value);
          }
          return newRow;
        });

        setImportStatus({ type: 'info', message: 'در حال ارسال اطلاعات به سرور...' });

        const response = await fetch('/api/personnel-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mappedData),
        });

        if (!response.ok) {
            const errorText = await response.text(); // Read response as text
            let errorMessage = 'خطا در ورود اطلاعات';
            try {
              // Try to parse as JSON to get a specific error message
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorJson.details || errorMessage;
            } catch (jsonError) {
              // If it's not JSON, it might be the generic Vercel error.
              // Don't show the raw HTML. Give a user-friendly message.
              console.error("Server Error Response:", errorText);
              errorMessage = `خطای سرور (${response.status}). لطفا دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.`;
            }
            throw new Error(errorMessage);
        }

        const successData = await response.json();
        setImportStatus({ type: 'success', message: successData.message || 'اطلاعات با موفقیت وارد شد. لیست به‌روزرسانی می‌شود.' });
        await fetchPersonnel();

      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطایی در پردازش فایل رخ داد.';
        setImportStatus({ type: 'error', message });
      } finally {
         if(fileInputRef.current) fileInputRef.current.value = ""; // Reset input
         setTimeout(() => setImportStatus(null), 5000);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    const dataToExport = personnelList.map(p => {
        const row: { [key: string]: any } = {};
        for(const header of EXPORT_HEADERS){
            const key = HEADER_MAP[header];
            row[header] = p[key];
        }
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Personnel');
    XLSX.writeFile(workbook, 'Personnel_List.xlsx');
  };

  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
    XLSX.writeFile(wb, 'Sample_Personnel_File.xlsx');
  };

  const handleEditClick = (personnel: Personnel) => {
    setEditingPersonnel(personnel);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingPersonnel(null);
  };

  const handleSave = async (updatedPersonnel: Personnel) => {
    setImportStatus({ type: 'info', message: 'در حال ذخیره تغییرات...' });
    try {
      const response = await fetch('/api/personnel-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPersonnel),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'خطا در ذخیره تغییرات';
        try {
            const errorData = JSON.parse(errorText);
            errorMsg = errorData.error || errorData.details || errorMsg;
        } catch (e) {
            errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const savedData = await response.json();
      setPersonnelList(prevList =>
        prevList.map(p => (p.id === savedData.personnel.id ? savedData.personnel : p))
      );
      handleCloseModal();
      setImportStatus({ type: 'success', message: 'اطلاعات با موفقیت به‌روزرسانی شد.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد.';
      setImportStatus({ type: 'error', message });
    } finally {
      setTimeout(() => setImportStatus(null), 5000);
    }
  };

  const statusColor = {
    info: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b-2 border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800">لیست کامل پرسنل</h2>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0 w-full sm:w-auto md:w-64">
                <input
                    type="text"
                    placeholder="جستجو (نام، کد پرسنلی، کد ملی...)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    aria-label="جستجوی پرسنل"
                />
                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleDownloadSample} className="text-sm text-blue-600 hover:underline">دانلود فایل نمونه</button>
                <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import" />
                <label htmlFor="excel-import" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">ورود از اکسل</label>
                <button onClick={handleExport} disabled={personnelList.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">خروجی اکسل</button>
            </div>
        </div>
      </div>

      {importStatus && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[importStatus.type]}`} role="alert">
          {importStatus.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-100">
            <tr>
              {TABLE_HEADERS.map(header => (
                <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading && <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4">در حال بارگذاری...</td></tr>}
            {error && <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-red-500">{error}</td></tr>}
            {!loading && !error && filteredPersonnel.length > 0 && filteredPersonnel.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                {EXPORT_HEADERS.map(header => {
                    const key = HEADER_MAP[header];
                    return (
                        <td key={key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{String(p[key] ?? '')}</td>
                    );
                })}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                  <button 
                    onClick={() => handleEditClick(p)}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors"
                    aria-label={`ویرایش ${p.first_name} ${p.last_name}`}
                  >
                    <PencilIcon className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !error && filteredPersonnel.length === 0 && (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-gray-500">
                    {personnelList.length === 0
                        ? "هیچ پرسنلی یافت نشد. می‌توانید از طریق فایل اکسل اطلاعات را وارد کنید."
                        : "هیچ پرسنلی با مشخصات وارد شده یافت نشد."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isEditModalOpen && editingPersonnel && (
        <EditPersonnelModal
          personnel={editingPersonnel}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default PersonnelListPage;