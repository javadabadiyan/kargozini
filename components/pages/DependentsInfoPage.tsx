import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SearchIcon, PencilIcon, TrashIcon, UsersIcon, UploadIcon, DownloadIcon } from '../icons/Icons';
import type { Dependent } from '../../types';
import EditDependentModal from '../EditDependentModal';

// Type alias for SheetJS, assuming it's loaded from a global script
declare const XLSX: any;

const DEPENDENT_HEADER_MAP: { [key: string]: keyof Omit<Dependent, 'id'> } = {
  'کد پرسنلی': 'personnel_code',
  'نام': 'first_name',
  'نام خانوادگی': 'last_name',
  'نام پدر': 'father_name',
  'نسبت': 'relation_type',
  'تاریخ تولد': 'birth_date',
  'جنسیت': 'gender',
  'ماه تولد': 'birth_month',
  'روز تولد': 'birth_day',
  'شماره شناسنامه': 'id_number',
  'کد ملی بستگان': 'national_id',
  'کد ملی سرپرست': 'guardian_national_id',
  'محل صدور شناسنامه': 'issue_place',
  'نوع': 'insurance_type',
};

const DEFAULT_DEPENDENT: Omit<Dependent, 'id'> = {
  personnel_code: '',
  first_name: '',
  last_name: '',
  father_name: null,
  relation_type: '',
  birth_date: '',
  gender: '',
  birth_month: null,
  birth_day: null,
  id_number: null,
  national_id: '',
  guardian_national_id: null,
  issue_place: null,
  insurance_type: null,
};


const EXPORT_HEADERS = Object.keys(DEPENDENT_HEADER_MAP);
const TABLE_VIEW_HEADERS = [
    'کد پرسنلی', 'نام', 'نام خانوادگی', 'نام پدر', 'نسبت', 'تاریخ تولد', 'جنسیت',
    'ماه تولد', 'روز تولد', 'شماره شناسنامه', 'کد ملی بستگان',
    'کد ملی سرپرست', 'محل صدور شناسنامه', 'نوع', 'عملیات'
];
const PAGE_SIZE = 10;

const DependentsInfoPage: React.FC = () => {
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Partial<Dependent> | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    const str = String(s);
    return str.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };
  
  const fetchDependents = useCallback(async (page: number, searchQuery = '') => {
      setLoading(true);
      setError(null);
      try {
          const response = await fetch(`/api/personnel?type=dependents&page=${page}&pageSize=${PAGE_SIZE}&searchTerm=${encodeURIComponent(searchQuery)}`);
          if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.error || 'خطا در دریافت اطلاعات بستگان');
          }
          const data = await response.json();
          setDependents(data.dependents || []);
          setTotalPages(Math.ceil((data.totalCount || 0) / PAGE_SIZE));
      } catch (err) {
          setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
      } finally {
          setLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchDependents(currentPage, searchTerm);
  }, [fetchDependents, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPage !== 1) {
        setCurrentPage(1);
    } else {
        fetchDependents(1, searchTerm);
    }
  };


  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
    XLSX.writeFile(wb, 'Sample_Dependents_File.xlsx');
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus({ type: 'info', message: 'در حال پردازش فایل اکسل...' });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy/mm/dd' });

        const mappedData = json.map(originalRow => {
            const row: {[key: string]: any} = {};
            for (const key in originalRow) {
                if (Object.prototype.hasOwnProperty.call(originalRow, key)) {
                    const normalizedKey = key.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
                    row[normalizedKey] = originalRow[key];
                }
            }
            
            const newRow: Partial<Omit<Dependent, 'id'>> = {};
            for (const header in DEPENDENT_HEADER_MAP) {
                if (row.hasOwnProperty(header)) {
                    const dbKey = DEPENDENT_HEADER_MAP[header as keyof typeof DEPENDENT_HEADER_MAP];
                    let value = row[header];
                    if (typeof value === 'string') {
                        value = value.replace(/[\u0000-\u001F\u200B-\u200D\u200E\u200F\uFEFF]/g, '').trim();
                    }
                    (newRow as any)[dbKey] = (value === null || value === undefined) ? null : String(value);
                }
            }
            return newRow as Omit<Dependent, 'id'>;
        });


        const response = await fetch('/api/personnel?type=dependents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mappedData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || errorData.error || 'خطا در ورود اطلاعات');
        }

        const successData = await response.json();
        setStatus({ type: 'success', message: successData.message || 'اطلاعات با موفقیت وارد شد.' });
        if(currentPage !== 1) setCurrentPage(1);
        else fetchDependents(1, searchTerm); // Refresh current view

      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطایی در پردازش فایل رخ داد.';
        setStatus({ type: 'error', message });
      } finally {
         if(fileInputRef.current) fileInputRef.current.value = "";
         setTimeout(() => setStatus(null), 5000);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = async () => {
    setStatus({type: 'info', message: 'در حال آماده‌سازی فایل اکسل...'});
    try {
        // Fetch all dependents for a complete backup (ignore pagination)
        const response = await fetch('/api/personnel?type=dependents&pageSize=100000');
        if(!response.ok) throw new Error('خطا در دریافت اطلاعات برای خروجی');
        const data = await response.json();
        const allDependents: Dependent[] = data.dependents || [];

        const dataToExport = allDependents.map((d: Dependent) => {
            const row: { [key: string]: any } = {};
            for(const header of EXPORT_HEADERS){
                const key = DEPENDENT_HEADER_MAP[header as keyof typeof DEPENDENT_HEADER_MAP];
                row[header] = toPersianDigits(d[key]);
            }
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dependents');
        XLSX.writeFile(workbook, 'Dependents_List.xlsx');
        setStatus(null);
    } catch(err) {
        const message = err instanceof Error ? err.message : 'خطا در خروجی گرفتن.';
        setStatus({type: 'error', message});
        setTimeout(() => setStatus(null), 5000);
    }
  };
  
    const handleOpenAddModal = () => {
        setEditingDependent(DEFAULT_DEPENDENT);
        setIsModalOpen(true);
    };
    
    const handleEditClick = (dependent: Dependent) => {
        setEditingDependent(dependent);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingDependent(null);
    };

    const handleSaveDependent = async (dependentData: Partial<Dependent>) => {
        const isNew = !dependentData.id;
        const method = isNew ? 'POST' : 'PUT';
        setStatus({ type: 'info', message: 'در حال ذخیره اطلاعات...' });
        try {
            const response = await fetch('/api/personnel?type=dependents', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dependentData),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.details || data.error || 'خطا در ذخیره اطلاعات');
            }
            setStatus({ type: 'success', message: data.message });
            handleCloseModal();
            fetchDependents(currentPage, searchTerm);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'خطای ناشناخته رخ داد.';
            setStatus({ type: 'error', message });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleDeleteDependent = async (dependentId: number) => {
        if (window.confirm('آیا از حذف این وابسته اطمینان دارید؟ این عمل قابل بازگشت نیست.')) {
            setStatus({ type: 'info', message: 'در حال حذف...' });
            try {
                const response = await fetch(`/api/personnel?type=dependents&id=${dependentId}`, {
                    method: 'DELETE',
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'خطا در حذف');
                }
                setStatus({ type: 'success', message: 'وابسته با موفقیت حذف شد.' });
                
                if (dependents.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else {
                    fetchDependents(currentPage, searchTerm);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'خطای ناشناخته رخ داد.';
                setStatus({ type: 'error', message });
            } finally {
                setTimeout(() => setStatus(null), 5000);
            }
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
        <h2 className="text-2xl font-bold text-gray-800">اطلاعات بستگان</h2>
        <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleOpenAddModal} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">افزودن دستی</button>
              <button onClick={handleDownloadSample} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                <DownloadIcon className="w-4 h-4"/> دانلود نمونه
              </button>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-dependents" />
              <label htmlFor="excel-import-dependents" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">
                <UploadIcon className="w-4 h-4"/> بازیابی از فایل
              </label>
              <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <DownloadIcon className="w-4 h-4"/> تهیه پشتیبان
              </button>
        </div>
      </div>
      
      {status && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`} role="alert" style={{ whiteSpace: 'pre-wrap' }}>
          {status.message}
        </div>
      )}

      <form onSubmit={handleSearchSubmit} className="mb-6">
        <label htmlFor="search-dependents" className="block text-sm font-medium text-gray-700 mb-2">
            جستجوی بستگان
        </label>
        <div className="flex">
            <div className="relative flex-grow">
              <input 
                type="text" 
                id="search-dependents" 
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="نام، کد ملی، کد پرسنلی..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-l-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                جستجو
            </button>
        </div>
      </form>

      <div className="overflow-x-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h4 className="text-lg font-semibold text-gray-700 mb-4">لیست بستگان</h4>
        {loading && <p className="text-center py-4">در حال بارگذاری اطلاعات...</p>}
        {error && <p className="text-center py-4 text-red-500">{error}</p>}
        {!loading && !error && dependents.length === 0 && (
            <div className="text-center py-10 text-gray-400">
                <UsersIcon className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">
                    {searchTerm ? 'هیچ وابسته‌ای مطابق با جستجوی شما یافت نشد.' : 'هیچ وابسته‌ای در سیستم ثبت نشده است.'}
                </h3>
                <p className="text-sm">می‌توانید اطلاعات را به صورت دستی یا از طریق یک فایل اکسل وارد کنید.</p>
            </div>
        )}
        {!loading && !error && dependents.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                    <tr>
                        {TABLE_VIEW_HEADERS.map(header => (
                            <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {dependents.map(d => (
                        <tr key={d.id}>
                            {TABLE_VIEW_HEADERS.filter(h => h !== 'عملیات').map(header => (
                                <td key={header} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{toPersianDigits(String(d[DEPENDENT_HEADER_MAP[header as keyof typeof DEPENDENT_HEADER_MAP]] ?? ''))}</td>
                            ))}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              <div className="flex items-center justify-center gap-2">
                                  <button 
                                      onClick={() => handleEditClick(d)}
                                      className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors"
                                      aria-label={`ویرایش ${d.first_name} ${d.last_name}`}
                                  >
                                      <PencilIcon className="w-5 h-5" />
                                  </button>
                                  <button 
                                      onClick={() => handleDeleteDependent(d.id)}
                                      className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors"
                                      aria-label={`حذف ${d.first_name} ${d.last_name}`}
                                  >
                                      <TrashIcon className="w-5 h-5" />
                                  </button>
                              </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
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

      {isModalOpen && editingDependent && (
        <EditDependentModal
            dependent={editingDependent}
            onClose={handleCloseModal}
            onSave={handleSaveDependent}
        />
      )}
    </div>
  );
};

export default DependentsInfoPage;