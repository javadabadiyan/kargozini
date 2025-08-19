import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UserTable, tableHeaders } from './UserTable';
import { AddUserModal } from './AddUserModal';
import { ViewPersonnelModal } from './ViewPersonnelModal';
import { PlusIcon, UploadIcon, DownloadIcon, DeleteIcon } from './icons';
import { SettingsPage } from './SettingsPage';
import { UserManagementPage } from './UserManagementPage';
import { DashboardView } from './DashboardView';
import type { Personnel, User } from '../types';
import * as XLSX from 'xlsx';

type Page = 'dashboard' | 'users' | 'settings' | 'user-management' |
            'commitment_letter' | 'disciplinary_committee' | 'performance_evaluation' | 'job_group' | 'bonus_management';

export const DashboardPage: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [appUsers, setAppUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [personnelToEdit, setPersonnelToEdit] = useState<Personnel | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [personnelToView, setPersonnelToView] = useState<Personnel | null>(null);

  // State for search and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;


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
    } catch (error)
 {
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
    XLSX.writeFile(wb, 'نمونه_ورود_پرسنل.xlsx');
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
        fetchPersonnel();
      } catch (error) {
        console.error("Excel import error:", error);
        alert(`خطا در ورود اطلاعات از اکسل: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
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

  const handleOpenViewModal = (p: Personnel) => {
    setPersonnelToView(p);
    setIsViewModalOpen(true);
  };

  const handleCloseViewModal = () => {
      setIsViewModalOpen(false);
      setPersonnelToView(null);
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
        fetchPersonnel();
      } catch (error) {
        console.error("Delete all personnel error:", error);
        alert("خطا در حذف تمام پرسنل!");
      }
    }
  };
  
  // Filtering and Pagination Logic
  const filteredPersonnel = personnel.filter(p =>
    p.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.personnel_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.national_id && p.national_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredPersonnel.length / ITEMS_PER_PAGE);
  const paginatedPersonnel = filteredPersonnel.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );
  
  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
      if (currentPage > 1) setCurrentPage(currentPage - 1);
  };
  
  const renderContent = () => {
    const PlaceholderPage = ({ title }: { title: string }) => (
        <div>
            <h1 className="text-2xl font-semibold text-gray-700 mb-6">{title}</h1>
            <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-600">این صفحه در حال ساخت است.</p>
            </div>
        </div>
    );
    switch(activePage) {
        case 'dashboard':
            return <DashboardView personnelCount={personnel.length} userCount={appUsers.length} />;
        case 'users':
            return (
                <div>
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-semibold text-gray-700">لیست پرسنل</h1>
                    <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
                        <button onClick={handleDownloadSample} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
                          <DownloadIcon className="w-5 h-5 ml-2" /> دانلود نمونه
                        </button>
                        <label className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition cursor-pointer">
                            <UploadIcon className="w-5 h-5 ml-2" /> ورود با اکسل
                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                        </label>
                        <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
                          <PlusIcon className="w-5 h-5 ml-2" /> افزودن پرسنل
                        </button>
                        <button onClick={handleDeleteAllPersonnel} className="flex items-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition">
                          <DeleteIcon className="w-5 h-5 ml-2" /> حذف کل
                        </button>
                    </div>
                  </div>
                   <div className="mb-4">
                        <input
                            type="text"
                            placeholder="جستجو بر اساس نام، کد پرسنلی، کد ملی و..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1); // Reset to first page on new search
                            }}
                            className="w-full md:w-1/2 lg:w-1/3 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                  {isLoading ? (
                    <div className="w-full bg-white rounded-lg shadow p-12 text-center text-gray-500">
                      در حال بارگذاری پرسنل...
                    </div>
                  ) : (
                    <>
                      <UserTable personnel={paginatedPersonnel} onView={handleOpenViewModal} onEdit={handleOpenModal} onDelete={handleDeletePersonnel} />
                      {totalPages > 1 && (
                        <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
                            <button onClick={handlePrevPage} disabled={currentPage === 1} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition">
                                قبلی
                            </button>
                            <span className="text-sm text-gray-700">صفحه {currentPage} از {totalPages} (مجموع: {filteredPersonnel.length} رکورد)</span>
                            <button onClick={handleNextPage} disabled={currentPage === totalPages} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition">
                                بعدی
                            </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
            );
        case 'user-management':
            return <UserManagementPage users={appUsers} onUsersChange={fetchAppUsers} />;
        case 'settings':
            return <SettingsPage />;
        case 'commitment_letter':
            return <PlaceholderPage title="نامه تعهد حسابداری" />;
        case 'disciplinary_committee':
            return <PlaceholderPage title="کمیته تشویق و انضباطی" />;
        case 'performance_evaluation':
            return <PlaceholderPage title="ارزیابی عملکرد" />;
        case 'job_group':
            return <PlaceholderPage title="گروه شغلی پرسنل" />;
        case 'bonus_management':
            return <PlaceholderPage title="مدیریت کارانه" />;
        default:
            return null;
    }
  }

  return (
    <div className="relative flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden md:mr-64">
        <Header onMenuToggle={() => setIsSidebarOpen(true)} />
        <main className="flex-1 flex flex-col overflow-y-auto bg-gray-100 p-4 sm:p-8">
          <div className="container mx-auto">
            {renderContent()}
          </div>
           <footer className="text-center text-gray-500 text-sm mt-auto pt-4">
              طراحی و کدنویسی جواد آبادیان
            </footer>
        </main>
      </div>
      {activePage === 'users' && (
        <>
            <AddUserModal 
              isOpen={isModalOpen} 
              onClose={handleCloseModal} 
              onSave={handleSavePersonnel}
              personnelToEdit={personnelToEdit}
            />
            <ViewPersonnelModal
              isOpen={isViewModalOpen}
              onClose={handleCloseViewModal}
              personnel={personnelToView}
            />
        </>
      )}
    </div>
  );
};