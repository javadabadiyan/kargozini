
import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserTable, tableHeaders } from './UserTable';
import { AddUserModal } from './AddUserModal';
import { PlusIcon, UploadIcon, DownloadIcon, DeleteIcon } from './icons';
import { SettingsPage } from './SettingsPage';
import { UserManagementPage } from './UserManagementPage';
import type { Personnel, User } from '../types';
import * as XLSX from 'xlsx';

type Page = 'users' | 'settings' | 'user-management';

export const DashboardPage: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('users');
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [appUsers, setAppUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [personnelToEdit, setPersonnelToEdit] = useState<Personnel | null>(null);

  const fetchPersonnel = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch personnel');
      const data = await response.json();
      setPersonnel(data);
    } catch (error) {
      console.error(error);
      alert("خطا در بارگذاری لیست پرسنل!");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppUsers = async () => {
     try {
      const response = await fetch('/api/app-users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setAppUsers(data);
    } catch (error) {
      console.error(error);
      alert("خطا در بارگذاری لیست کاربران!");
    }
  }

  useEffect(() => {
    fetchPersonnel();
    fetchAppUsers();
  }, []);
  
  const handleDownloadSample = () => {
    const persianHeaders = tableHeaders.map(h => h.label);
    const ws = XLSX.utils.aoa_to_sheet([persianHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personnel');
    XLSX.writeFile(wb, 'Sample_Personnel.xlsx');
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
        const jsonFromSheet: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonFromSheet.length === 0) {
          alert('فایل اکسل خالی است یا فرمت آن صحیح نیست.');
          return;
        }

        const labelToKeyMap = tableHeaders.reduce((acc, header) => {
            acc[header.label] = header.key;
            return acc;
        }, {} as Record<string, string>);

        const mappedJson = jsonFromSheet.map(row => {
            const newRow: any = {};
            for (const persianKey in row) {
                const englishKey = labelToKeyMap[persianKey];
                if (englishKey) {
                    // Ensure all values from excel are treated as strings to avoid type issues
                    newRow[englishKey] = row[persianKey] != null ? String(row[persianKey]) : '';
                }
            }
            return newRow as Omit<Personnel, 'id'>;
        });


        const response = await fetch('/api/users?action=import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mappedJson),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to import personnel');
        }

        alert(`${mappedJson.length} پرسنل با موفقیت وارد شدند.`);
        fetchPersonnel(); // Refresh the list
      } catch (error) {
        console.error("Excel import error:", error);
        alert(`خطا در ورود اطلاعات از اکسل: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
         // Reset file input
        event.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };


  const handleOpenModal = (p: Personnel | null = null) => {
    setPersonnelToEdit(p);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setPersonnelToEdit(null);
  };

  const handleSavePersonnel = async (personnelData: Omit<Personnel, 'id'>) => {
    const isEditing = !!personnelToEdit;
    const body = isEditing ? { ...personnelData, id: personnelToEdit!.id } : personnelData;

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save personnel');
        }
        
        const savedPersonnel: Personnel = await response.json();

        if (isEditing) {
            setPersonnel(personnel.map(p => (p.id === savedPersonnel.id ? savedPersonnel : p)));
        } else {
            setPersonnel([savedPersonnel, ...personnel]);
        }
        handleCloseModal();
    } catch (error) {
        console.error("Save personnel error:", error);
        alert(`خطا در ذخیره سازی پرسنل: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeletePersonnel = async (personnelId: number) => {
    if (window.confirm('آیا از حذف این پرسنل اطمینان دارید؟')) {
      try {
        const response = await fetch(`/api/users?id=${personnelId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to delete personnel');

        setPersonnel(personnel.filter(p => p.id !== personnelId));
      } catch (error) {
        console.error("Delete personnel error:", error);
        alert("خطا در حذف پرسنل!");
      }
    }
  };

  const handleDeleteAllPersonnel = async () => {
    if (window.confirm('آیا کاملا اطمینان دارید؟ تمام اطلاعات پرسنل برای همیشه حذف خواهد شد. این عمل غیرقابل بازگشت است.')) {
      try {
        const response = await fetch(`/api/users?action=delete_all`, {
          method: 'DELETE',
        });
        
        if (!response.ok) throw new Error('Failed to delete all personnel');

        alert('تمام اطلاعات پرسنل با موفقیت حذف شد.');
        fetchPersonnel(); // Refresh the list to show it's empty
      } catch (error) {
        console.error("Delete all personnel error:", error);
        alert("خطا در حذف تمام پرسنل!");
      }
    }
  };
  
  const renderContent = () => {
    switch(activePage) {
        case 'users':
            return (
                <div>
                  <div className="flex justify-between items-center mb-6 gap-2 flex-wrap">
                    <h1 className="text-2xl font-semibold text-gray-700">لیست پرسنل</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={handleDownloadSample}
                          className="flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
                        >
                          <DownloadIcon className="w-5 h-5 ml-2" />
                          دانلود نمونه
                        </button>
                        <label className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition cursor-pointer">
                            <UploadIcon className="w-5 h-5 ml-2" />
                            ورود با اکسل
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                        </label>
                        <button
                          onClick={() => handleOpenModal()}
                          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
                        >
                          <PlusIcon className="w-5 h-5 ml-2" />
                          افزودن پرسنل جدید
                        </button>
                        <button
                          onClick={handleDeleteAllPersonnel}
                          className="flex items-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
                        >
                          <DeleteIcon className="w-5 h-5 ml-2" />
                          حذف کل اطلاعات
                        </button>
                    </div>
                  </div>
                  {isLoading ? (
                    <div className="w-full bg-white rounded-lg shadow p-12 text-center text-gray-500">
                      در حال بارگذاری پرسنل...
                    </div>
                  ) : (
                    <UserTable personnel={personnel} onEdit={handleOpenModal} onDelete={handleDeletePersonnel} />
                  )}
                </div>
            );
        case 'user-management':
            return <UserManagementPage users={appUsers} onUsersChange={fetchAppUsers} />;
        case 'settings':
            return <SettingsPage />;
        default:
            return null;
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden mr-64">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-8">
          <div className="container mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
      {activePage === 'users' && (
        <AddUserModal 
          isOpen={isModalOpen} 
          onClose={handleCloseModal} 
          onSave={handleSavePersonnel}
          personnelToEdit={personnelToEdit}
        />
      )}
    </div>
  );
};