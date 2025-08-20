import React, { useState, useEffect, useMemo } from 'react';
import type { Personnel, SecurityMember } from '../types';
import { PlusIcon, UploadIcon, DownloadIcon, DeleteIcon } from './icons';
import { AddSecurityMemberModal } from './AddSecurityMemberModal';
import { toPersianDigits } from './format';
import * as XLSX from 'xlsx';

interface SecurityMembersPageProps {
  personnelList: Personnel[];
}

const tableHeaders = [
  { key: 'first_name', label: 'نام' },
  { key: 'last_name', label: 'نام خانوادگی' },
  { key: 'personnel_code', label: 'کد پرسنلی' },
  { key: 'unit', label: 'واحد' },
  { key: 'position', label: 'سمت' },
];

export const SecurityMembersPage: React.FC<SecurityMembersPageProps> = ({ personnelList }) => {
  const [securityMembers, setSecurityMembers] = useState<SecurityMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSecurityMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/security-members');
      if (!response.ok) throw new Error('Failed to fetch security members');
      const data = await response.json();
      setSecurityMembers(data);
    } catch (error) {
      console.error(error);
      alert("خطا در بارگذاری لیست اعضای تردد!");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityMembers();
  }, []);
  
  const handleAddMember = async (personnelId: number) => {
    try {
      const response = await fetch('/api/security-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personnel_id: personnelId }),
      });
      if (!response.ok) throw new Error('Failed to add member');
      await fetchSecurityMembers();
      setIsModalOpen(false);
    } catch (error) {
      alert('خطا در افزودن عضو.');
    }
  };
  
  const handleDeleteMember = async (personnelId: number) => {
    if (window.confirm('آیا از حذف این عضو از لیست تردد اطمینان دارید؟')) {
      try {
        const response = await fetch(`/api/security-members?id=${personnelId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete member');
        await fetchSecurityMembers();
      } catch (error) {
        alert('خطا در حذف عضو.');
      }
    }
  };
  
  const handleDeleteAll = async () => {
    if (window.confirm('هشدار! آیا از حذف تمام اعضای لیست تردد اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) {
      try {
        const response = await fetch('/api/security-members?action=delete_all', { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete all members');
        await fetchSecurityMembers();
      } catch (error) {
        alert('خطا در حذف همه اعضا.');
      }
    }
  };

  const handleDownloadSample = () => {
    const headers = tableHeaders.map(h => h.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Security Members');
    XLSX.writeFile(wb, 'نمونه_ورود_اعضای_تردد.xlsx');
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
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          alert('فایل اکسل خالی است.');
          return;
        }

        const personnelCodes = json.map(row => String(row['کد پرسنلی'] || '')).filter(code => code);

        const response = await fetch('/api/security-members?action=import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(personnelCodes),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to import members');
        }

        alert(`${toPersianDigits(personnelCodes.length)} عضو با موفقیت وارد شدند.`);
        await fetchSecurityMembers();
      } catch (error) {
        alert(`خطا در ورود اطلاعات از اکسل: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };
  
  const handleExportExcel = () => {
    const dataToExport = filteredMembers.map(member => ({
        'نام': member.first_name,
        'نام خانوادگی': member.last_name,
        'کد پرسنلی': member.personnel_code,
        'واحد': member.unit,
        'سمت': member.position,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "اعضای تردد");
    XLSX.writeFile(wb, "خروجی_اعضای_تردد.xlsx");
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return securityMembers;
    const query = searchQuery.toLowerCase();
    return securityMembers.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(query) ||
      m.personnel_code.toLowerCase().includes(query) ||
      m.unit.toLowerCase().includes(query) ||
      m.position.toLowerCase().includes(query)
    );
  }, [securityMembers, searchQuery]);

  return (
    <div className="animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-slate-700">کارمندان عضو تردد</h1>
        <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
          <button onClick={handleDownloadSample} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-green-100 text-green-800 hover:bg-green-200 focus:ring-green-500">
            <DownloadIcon className="w-5 h-5 ml-2" /> دانلود نمونه
          </button>
          <label className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500 cursor-pointer">
            <UploadIcon className="w-5 h-5 ml-2" /> ورود با اکسل
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
          </label>
           <button onClick={handleExportExcel} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-teal-100 text-teal-800 hover:bg-teal-200 focus:ring-teal-500">
            <DownloadIcon className="w-5 h-5 ml-2" /> خروجی اکسل
          </button>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500">
            <PlusIcon className="w-5 h-5 ml-2" /> افزودن عضو
          </button>
           <button onClick={handleDeleteAll} className="flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg shadow-sm bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500">
            <DeleteIcon className="w-5 h-5 ml-2" /> حذف کل
          </button>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="جستجو..."
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
                  <th key={header.key} scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                    {header.label}
                  </th>
                ))}
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={tableHeaders.length + 1} className="px-6 py-12 text-center text-slate-500">
                    موردی یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{member.first_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{member.last_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{toPersianDigits(member.personnel_code)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{member.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{member.position}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                      <div className="flex items-center justify-end">
                        <button onClick={() => handleDeleteMember(member.id)} className="text-slate-400 hover:text-red-600 transition" title="حذف">
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
      <AddSecurityMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddMember}
        personnelList={personnelList}
        existingMemberIds={securityMembers.map(m => m.id)}
      />
    </div>
  );
};
