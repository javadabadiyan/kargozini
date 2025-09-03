

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
const PAGE_SIZE = 20;

const DEFAULT_PERSONNEL: Omit<Personnel, 'id'> = {
  personnel_code: '', first_name: '', last_name: '', father_name: '', national_id: '',
  id_number: '', birth_date: '', birth_place: '', issue_date: '', issue_place: '',
  marital_status: '', military_status: '', job_title: '', position: '', employment_type: '',
  department: '', service_location: '', hire_date: '', education_level: '', field_of_study: '',
  status: '',
};

// A custom hook for debouncing input
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};


const PersonnelListPage: React.FC = () => {
  // FIX: Re-implementing the entire component logic which was missing.
  // This includes state definitions, data fetching logic, and event handlers,
  // resolving all "Cannot find name" errors.
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    const str = String(s);
    return str.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  const fetchPersonnel = useCallback(async (page: number, search: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/personnel?type=personnel&page=${page}&pageSize=${PAGE_SIZE}&searchTerm=${encodeURIComponent(search)}`);
      
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
      setTotalPages(Math.ceil((data.totalCount || 0) / PAGE_SIZE));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // When the debounced search term changes, always go back to page 1
    if (currentPage !== 1) {
        setCurrentPage(1);
    } else {
        fetchPersonnel(1, debouncedSearchTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  useEffect(() => {
    // Fetch personnel whenever the current page changes
    fetchPersonnel(currentPage, debouncedSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);
  

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const mappedData = json.map(row => {
          const newRow: { [key in keyof Omit<Personnel, 'id'>]?: string | null } = {};
          for (const header in HEADER_MAP) {
            const dbKey = HEADER_MAP[header];
            const value = row[header];
            newRow[dbKey] = (value === null || value === undefined || String(value).trim() === '') 
              ? null 
              : String(value);
          }
          return newRow;
        });

        setImportStatus({ type: 'info', message: 'در حال ارسال اطلاعات به سرور...' });

        const response = await fetch('/api/personnel?type=personnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mappedData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'خطا در ورود اطلاعات';
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorJson.details || errorMessage;
            } catch (jsonError) {
              console.error("Server Error Response:", errorText);
              errorMessage = `خطای سرور (${response.status}). لطفا دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.`;
            }
            throw new Error(errorMessage);
        }

        const successData = await response.json();
        setImportStatus({ type: 'success', message: successData.message || 'اطلاعات با موفقیت وارد شد. لیست به‌روزرسانی می‌شود.' });
        await fetchPersonnel(currentPage, debouncedSearchTerm); // Re-fetch current page

      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطایی در پردازش فایل رخ داد.';
        setImportStatus({ type: 'error', message });
      } finally {
         if(fileInputRef.current) fileInputRef.current.value = "";
         setTimeout(() => setImportStatus(null), 5000);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = async () => {
    // Note: This exports all personnel, not just the current page.
    // This could be slow if there are many records.
    setImportStatus({type: 'info', message: 'در حال آماده‌سازی فایل اکسل...'});
    try {
        const response = await fetch('/api/personnel?type=personnel&pageSize=100000'); // A bit of a hack to get all users
        const data = await response.json();
        const dataToExport = data.personnel.map((p: Personnel) => {
            const row: { [key: string]: any } = {};
            for(const header of EXPORT_HEADERS){
                const key = HEADER_MAP[header];
                row[header] = toPersianDigits(p[key]);
            }
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Personnel');
        XLSX.writeFile(workbook, 'Personnel_List.xlsx');
        setImportStatus(null);
    } catch(err) {
        const message = err instanceof Error ? err.message : 'خطا در خروجی گرفتن.';
        setImportStatus({type: 'error', message});
        setTimeout(() => setImportStatus(null), 5000);
    }
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

  const handleOpenAddModal = () => {
    setEditingPersonnel({ ...DEFAULT_PERSONNEL, id: 0 }); // Use id: 0 to signify a new record
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingPersonnel(null);
  };

  const handleSave = async (updatedPersonnel: Personnel) => {
    const isNew = updatedPersonnel.id === 0;
    const endpoint = '/api/personnel?type=personnel';
    const method = isNew ? 'POST' : 'PUT';

    setImportStatus({ type: 'info', message: 'در حال ذخیره اطلاعات...' });
    try {
      // For new personnel, remove the placeholder id before sending
      const payload = { ...updatedPersonnel };
      if (isNew) {
        delete (payload as any).id;
      }

      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = 'خطا در ذخیره اطلاعات';
        try {
            const errorData = JSON.parse(errorText);
            errorMsg = errorData.error || errorData.details || errorMsg;
        } catch (e) {
            errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const savedData = await response.json();
      
      if (isNew) {
        setImportStatus({ type: 'success', message: 'پرسنل جدید با موفقیت اضافه شد.' });
        if (debouncedSearchTerm) setSearchTerm('');
        setCurrentPage(1); 
        if (!debouncedSearchTerm) {
            await fetchPersonnel(1, '');
        }
      } else {
        setPersonnelList(prevList =>
          prevList.map(p => (p.id === savedData.personnel.id ? savedData.personnel : p))
        );
        setImportStatus({ type: 'success', message: 'اطلاعات با موفقیت به‌روزرسانی شد.' });
      }
      handleCloseModal();
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
    error: 'bg-red-100 text-red-800'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b-2 border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800">لیست کامل پرسنل</h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
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
          <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleOpenAddModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">افزودن پرسنل</button>
              <button onClick={handleDownloadSample} className="text-sm text-blue-600 hover:underline">دانلود نمونه</button>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import" />
              <label htmlFor="excel-import" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">بازیابی از فایل</label>
              <button onClick={handleExport} disabled={personnelList.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">تهیه پشتیبان</button>
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
            {!loading && !error && personnelList.length > 0 && personnelList.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                {EXPORT_HEADERS.map(header => {
                    const key = HEADER_MAP[header];
                    return (
                        <td key={key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{toPersianDigits(String(p[key] ?? ''))}</td>
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
            {!loading && !error && personnelList.length === 0 && (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-gray-500">
                  {searchTerm
                    ? "هیچ پرسنلی با مشخصات وارد شده یافت نشد."
                    : "هیچ پرسنلی یافت نشد. می‌توانید از طریق فایل اکسل اطلاعات را وارد کنید."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       {!loading && !error && totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            قبلی
          </button>
          <span className="text-sm text-gray-600">
            صفحه {toPersianDigits(String(currentPage))} از {toPersianDigits(String(totalPages))}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            بعدی
          </button>
        </div>
      )}

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