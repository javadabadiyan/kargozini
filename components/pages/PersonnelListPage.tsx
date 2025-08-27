import React, { useState, useEffect, useRef } from 'react';
import type { Personnel } from '../../types';
import EditPersonnelModal from '../EditPersonnelModal';
import { PencilIcon } from '../icons/Icons';

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

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/personnel');
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMsg = 'خطا در دریافت اطلاعات از سرور';
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch (e) {
           errorMsg = responseText || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      const data = JSON.parse(responseText);
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
          const newRow: any = {};
          for (const key in row) {
            const mappedKey = HEADER_MAP[key.trim()];
            if (mappedKey) {
              newRow[mappedKey] = String(row[key]);
            }
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
          const errorData = await response.json();
          throw new Error(errorData.error || 'خطا در ورود اطلاعات');
        }

        setImportStatus({ type: 'success', message: 'اطلاعات با موفقیت وارد شد. لیست به‌روزرسانی می‌شود.' });
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

      const responseText = await response.text();

      if (!response.ok) {
        let errorMsg = 'خطا در ذخیره تغییرات';
        try {
            const errorData = JSON.parse(responseText);
            errorMsg = errorData.error || errorData.details || errorMsg;
        } catch (e) {
            errorMsg = responseText || errorMsg;
        }
        throw new Error(errorMsg);
      }

      setPersonnelList(prevList =>
        prevList.map(p => (p.id === updatedPersonnel.id ? updatedPersonnel : p))
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
      <div className="flex flex-wrap justify-between items-center mb-6 border-b-2 border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800">لیست کامل پرسنل</h2>
        <div className="flex items-center gap-2 mt-4 sm:mt-0">
          <button onClick={handleDownloadSample} className="text-sm text-blue-600 hover:underline">دانلود فایل نمونه</button>
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileImport} className="hidden" id="excel-import" />
          <label htmlFor="excel-import" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors">ورود از اکسل</label>
          <button onClick={handleExport} disabled={personnelList.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">خروجی اکسل</button>
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
            {!loading && !error && personnelList.length === 0 && (
              <tr><td colSpan={TABLE_HEADERS.length} className="text-center p-4 text-gray-500">هیچ پرسنلی یافت نشد. می‌توانید از طریق فایل اکسل اطلاعات را وارد کنید.</td></tr>
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