import React, { useState, useEffect } from 'react';
import type { Personnel, Relative, RelativeWithPersonnel } from '../types';
import { PlusIcon, UploadIcon, DownloadIcon, EditIcon, DeleteIcon } from './icons';
import { AddRelativeModal } from './AddRelativeModal';
import * as XLSX from 'xlsx';
import { toPersianDigits } from './format';

interface RelativesPageProps {
  personnelList: Personnel[];
}

const tableHeaders = [
    { key: 'personnel', label: 'پرسنل' },
    { key: 'personnel_code', label: 'کد پرسنلی' },
    { key: 'first_name', label: 'نام بستگان' },
    { key: 'last_name', label: 'نام خانوادگی بستگان' },
    { key: 'relation', label: 'نسبت' },
    { key: 'national_id', label: 'کد ملی' },
    { key: 'birth_date', label: 'تاریخ تولد' },
];

export const RelativesPage: React.FC<RelativesPageProps> = ({ personnelList }) => {
  const [relatives, setRelatives] = useState<RelativeWithPersonnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [relativeToEdit, setRelativeToEdit] = useState<Relative | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRelatives = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/relatives');
      if (!response.ok) throw new Error('Failed to fetch relatives');
      const data = await response.json();
      setRelatives(data);
    } catch (error) {
      console.error(error);
      alert("خطا در بارگذاری لیست بستگان!");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRelatives();
  }, []);

  const handleOpenModal = (relative: Relative | null = null) => {
    setRelativeToEdit(relative);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setRelativeToEdit(null);
  };

  const handleSaveRelative = async (relativeData: Omit<Relative, 'id'> | Relative) => {
    try {
        const response = await fetch('/api/relatives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(relativeData),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save relative');
        }
        await fetchRelatives();
        handleCloseModal();
    } catch (error) {
        alert(`خطا در ذخیره سازی اطلاعات: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteRelative = async (relativeId: number) => {
    if (window.confirm('آیا از حذف این مورد اطمینان دارید؟')) {
      try {
        const response = await fetch(`/api/relatives?id=${relativeId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete relative');
        await fetchRelatives();
      } catch (error) {
        alert("خطا در حذف اطلاعات!");
      }
    }
  };

  const handleDownloadSample = () => {
    const headers = ['کد پرسنلی', 'نام', 'نام خانوادگی', 'نسبت', 'کد ملی', 'تاریخ تولد'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatives');
    XLSX.writeFile(wb, 'نمونه_ورود_بستگان.xlsx');
  };

  const handleExcelImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (json.length < 2) {
             alert('فایل اکسل خالی است یا فقط دارای سربرگ است.');
             return;
        }

        const headers = json[0];
        const headerMap: Record<string, string> = {
            'کد پرسنلی': 'personnel_code',
            'نام': 'first_name',
            'نام خانوادگی': 'last_name',
            'نسبت': 'relation',
            'کد ملی': 'national_id',
            'تاریخ تولد': 'birth_date',
        };

        const mappedJson = json.slice(1).map(row => {
            const newRow: any = {};
            headers.forEach((header: string, index: number) => {
                const key = headerMap[header];
                if (key) {
                    newRow[key] = row[index] != null ? String(row[index]) : '';
                }
            });
            return newRow;
        });

        const response = await fetch('/api/relatives?action=import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mappedJson),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to import relatives');
        }

        alert(`${toPersianDigits(mappedJson.length)} ردیف با موفقیت وارد شد.`);
        await fetchRelatives();
      } catch (error) {
        alert(`خطا در ورود اطلاعات از اکسل: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredRelatives = relatives.filter(r => {
    const query = searchQuery.toLowerCase();
    return (
        `${r.personnel_first_name} ${r.personnel_last_name}`.toLowerCase().includes(query) ||
        r.personnel_code.toLowerCase().includes(query) ||
        r.first_name.toLowerCase().includes(query) ||
        r.last_name.toLowerCase().includes(query) ||
        (r.national_id && r.national_id.toLowerCase().includes(query))
    );
  });

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-slate-700">اطلاعات بستگان</h1>
        <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
          <button onClick={handleDownloadSample} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-500">
            <DownloadIcon className="w-5 h-5 ml-2" /> دانلود نمونه
          </button>
          <label className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500 cursor-pointer">
            <UploadIcon className="w-5 h-5 ml-2" /> ورود با اکسل
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
          </label>
          <button onClick={() => handleOpenModal()} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500">
            <PlusIcon className="w-5 h-5 ml-2" /> افزودن فرد جدید
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="جستجو بر اساس نام پرسنل، نام بستگان، کد ملی و..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="w-full bg-white rounded-xl shadow-md p-12 text-center text-slate-500">
          در حال بارگذاری...
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {tableHeaders.map(header => (
                  <th key={header.key} scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {header.label}
                  </th>
                ))}
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredRelatives.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length + 1} className="px-6 py-12 text-center text-slate-500">
                    موردی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredRelatives.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{r.personnel_first_name} {r.personnel_last_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(r.personnel_code)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{r.first_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{r.last_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{r.relation}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(r.national_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(r.birth_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                      <div className="flex items-center justify-end space-x-4 space-x-reverse">
                        <button onClick={() => handleOpenModal(r)} className="text-slate-400 hover:text-indigo-600 transition" title="ویرایش">
                          <EditIcon />
                        </button>
                        <button onClick={() => handleDeleteRelative(r.id)} className="text-slate-400 hover:text-red-600 transition" title="حذف">
                          <DeleteIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <AddRelativeModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveRelative}
        relativeToEdit={relativeToEdit}
        personnelList={personnelList}
      />
    </div>
  );
};
