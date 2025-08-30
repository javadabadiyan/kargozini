import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SearchIcon, UserIcon, UsersIcon } from '../icons/Icons';
import type { Personnel, Dependent } from '../../types';

// Type alias for SheetJS, assuming it's loaded from a global script
declare const XLSX: any;

const DEPENDENT_HEADER_MAP: { [key: string]: keyof Omit<Dependent, 'id'> } = {
  'کد پرسنلی': 'personnel_code',
  'نوع وابستگی': 'relation_type',
  'نام': 'first_name',
  'نام خانوادگی': 'last_name',
  'کد ملی': 'national_id',
  'تاریخ تولد': 'birth_date',
  'جنسیت': 'gender',
};

const EXPORT_HEADERS = Object.keys(DEPENDENT_HEADER_MAP);

const DependentsInfoPage: React.FC = () => {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [personnelLoading, setPersonnelLoading] = useState(true);
  const [dependentsLoading, setDependentsLoading] = useState(false);
  
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [dependentsError, setDependentsError] = useState<string | null>(null);
  
  const [importStatus, setImportStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toPersianDigits = (s: string | null | undefined): string => {
    if (s === null || s === undefined) return '';
    const str = String(s);
    return str.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
  };

  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        setPersonnelLoading(true);
        setPersonnelError(null);
        const response = await fetch('/api/personnel?pageSize=100000');

        if (!response.ok) {
          throw new Error('خطا در دریافت لیست پرسنل');
        }
        
        const data = await response.json();
        setPersonnelList(data.personnel || []);
      } catch (err) {
        setPersonnelError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
      } finally {
        setPersonnelLoading(false);
      }
    };
    fetchPersonnel();
  }, []);

  useEffect(() => {
    if (!selectedPersonnel) {
      setDependents([]);
      return;
    }

    const fetchDependents = async () => {
      try {
        setDependentsLoading(true);
        setDependentsError(null);
        const response = await fetch(`/api/dependents?personnel_code=${selectedPersonnel.personnel_code}`);
        if (!response.ok) {
           const errorData = await response.json();
           throw new Error(errorData.error || 'خطا در دریافت اطلاعات بستگان');
        }
        const data = await response.json();
        setDependents(data.dependents || []);
      } catch (err) {
        setDependentsError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
      } finally {
        setDependentsLoading(false);
      }
    };

    fetchDependents();
  }, [selectedPersonnel]);

  const filteredPersonnel = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase().trim();
    if (!lowercasedTerm) return personnelList;
    return personnelList.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
      p.personnel_code.toLowerCase().includes(lowercasedTerm) ||
      (p.national_id && p.national_id.toLowerCase().includes(lowercasedTerm))
    );
  }, [personnelList, searchTerm]);

  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نمونه');
    XLSX.writeFile(wb, 'Sample_Dependents_File.xlsx');
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          const newRow: { [key in keyof Omit<Dependent, 'id'>]?: string | null } = {};
          for (const header in DEPENDENT_HEADER_MAP) {
            const dbKey = DEPENDENT_HEADER_MAP[header];
            const value = row[header];
            newRow[dbKey] = (value === null || value === undefined) ? null : String(value);
          }
          return newRow;
        });

        const response = await fetch('/api/dependents-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mappedData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'خطا در ورود اطلاعات');
        }

        const successData = await response.json();
        setImportStatus({ type: 'success', message: successData.message || 'اطلاعات با موفقیت وارد شد.' });
        // Refresh dependents if the currently selected personnel was affected
        if (selectedPersonnel) {
           const fetchAgain = async () => {
             const res = await fetch(`/api/dependents?personnel_code=${selectedPersonnel.personnel_code}`);
             const data = await res.json();
             setDependents(data.dependents || []);
           }
           fetchAgain();
        }

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
    setImportStatus({type: 'info', message: 'در حال آماده‌سازی فایل اکسل...'});
    try {
        const response = await fetch('/api/dependents');
        if(!response.ok) throw new Error('خطا در دریافت اطلاعات برای خروجی');
        const data = await response.json();

        const dataToExport = data.dependents.map((d: Dependent) => {
            const row: { [key: string]: any } = {};
            for(const header of EXPORT_HEADERS){
                const key = DEPENDENT_HEADER_MAP[header];
                row[header] = toPersianDigits(d[key]);
            }
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Dependents');
        XLSX.writeFile(workbook, 'Dependents_List.xlsx');
        setImportStatus(null);
    } catch(err) {
        const message = err instanceof Error ? err.message : 'خطا در خروجی گرفتن.';
        setImportStatus({type: 'error', message});
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b-2 border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800">اطلاعات بستگان</h2>
        <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleDownloadSample} className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-200 transition-colors">دانلود نمونه</button>
              <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import-dependents" />
              <label htmlFor="excel-import-dependents" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">ورود از اکسل</label>
              <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">خروجی اکسل</button>
        </div>
      </div>
      
      {importStatus && (
        <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[importStatus.type]}`} role="alert">
          {importStatus.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label htmlFor="search-personnel" className="block text-sm font-medium text-gray-700 mb-2">
              جستجوی پرسنل
            </label>
            <div className="relative">
              <input 
                type="text" 
                id="search-personnel" 
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="نام، کد پرسنلی، کد ملی..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            <div className="mt-4 max-h-96 overflow-y-auto">
              {personnelLoading && <p className="text-center text-gray-500">در حال بارگذاری...</p>}
              {personnelError && <p className="text-center text-red-500">{personnelError}</p>}
              {!personnelLoading && !personnelError && (
                <ul className="space-y-2">
                  {filteredPersonnel.map(person => (
                    <li 
                      key={person.id}
                      onClick={() => setSelectedPersonnel(person)}
                      className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${selectedPersonnel?.id === person.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
                    >
                      <UserIcon className="w-5 h-5 ml-2" />
                      {person.first_name} {person.last_name}
                    </li>
                  ))}
                   {filteredPersonnel.length === 0 && <p className="text-center text-gray-500">پرسنلی یافت نشد.</p>}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
            {!selectedPersonnel ? (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-full flex items-center justify-center">
                    <div className="text-center text-gray-400">
                        <UsersIcon className="w-16 h-16 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">اطلاعات بستگان</h3>
                        <p className="text-sm">برای مشاهده اطلاعات، یک پرسنل را از لیست انتخاب کنید.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-4">
                            <UserIcon className="w-12 h-12 text-blue-500" />
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{selectedPersonnel.first_name} {selectedPersonnel.last_name}</h3>
                                <p className="text-sm text-gray-600">کد پرسنلی: <span className="font-mono">{toPersianDigits(selectedPersonnel.personnel_code)}</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <h4 className="text-lg font-semibold text-gray-700 mb-4">لیست بستگان</h4>
                      {dependentsLoading && <p className="text-center py-4">در حال بارگذاری اطلاعات بستگان...</p>}
                      {dependentsError && <p className="text-center py-4 text-red-500">{dependentsError}</p>}
                      {!dependentsLoading && !dependentsError && dependents.length === 0 && <p className="text-center py-4 text-gray-500">هیچ وابسته‌ای برای این پرسنل ثبت نشده است.</p>}
                      {!dependentsLoading && !dependentsError && dependents.length > 0 && (
                          <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                  <tr>
                                      {EXPORT_HEADERS.slice(1).map(header => ( // Hide "کد پرسنلی"
                                          <th key={header} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{header}</th>
                                      ))}
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                  {dependents.map(d => (
                                      <tr key={d.id}>
                                          {EXPORT_HEADERS.slice(1).map(header => (
                                              <td key={header} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{toPersianDigits(String(d[DEPENDENT_HEADER_MAP[header]] ?? ''))}</td>
                                          ))}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default DependentsInfoPage;