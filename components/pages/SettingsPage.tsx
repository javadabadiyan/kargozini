import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AppUser, UserPermissions } from '../../types';
import UserEditModal from '../UserEditModal';
import { PencilIcon, TrashIcon, DownloadIcon, UploadIcon } from '../icons/Icons';

declare const XLSX: any;

const PERMISSION_KEYS: { key: keyof UserPermissions, label: string }[] = [
    { key: 'dashboard', label: 'داشبورد' },
    { key: 'personnel', label: 'منوی مدیریت پرسنل' },
    { key: 'personnel_list', label: ' - لیست پرسنل' },
    { key: 'dependents_info', label: ' - اطلاعات بستگان' },
    { key: 'document_upload', label: ' - بارگذاری مدارک' },
    { key: 'recruitment', label: 'منوی کارگزینی' },
    { key: 'accounting_commitment', label: ' - نامه تعهد (صدور و بایگانی)' },
    { key: 'disciplinary_committee', label: ' - کمیته تشویق و انضباطی' },
    { key: 'performance_review', label: ' - ارزیابی عملکرد' },
    { key: 'send_performance_review', label: '   - ارسال ارزیابی عملکرد پرسنل' },
    { key: 'archive_performance_review', label: '   - بایگانی ارزیابی عملکرد پرسنل' },
    { key: 'job_group', label: ' - گروه شغلی پرسنل' },
    { key: 'bonus_management', label: ' - مدیریت کارانه' },
    { key: 'enter_bonus', label: '   - ارسال کارانه' },
    { key: 'bonus_analyzer', label: '   - تحلیلگر هوشمند کارانه' },
    { key: 'security', label: 'منوی حراست' },
    { key: 'commuting_members', label: ' - کارمندان عضو تردد' },
    { key: 'log_commute', label: ' - ثبت تردد' },
    { key: 'commute_report', label: ' - گزارش گیری تردد' },
    { key: 'settings', label: 'تنظیمات' },
    { key: 'user_management', label: 'مدیریت کاربران (در تنظیمات)' },
];

const PERMISSION_ROLES: { [key: string]: { label: string; permissions: UserPermissions } } = {
  admin: {
    label: 'دسترسی کامل (ادمین)',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      acc[perm.key] = true;
      return acc;
    }, {} as UserPermissions),
  },
  supervisor: {
    label: 'سرپرست',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      const supervisorPermissions: (keyof UserPermissions)[] = [
          'dashboard', 'personnel', 'personnel_list', 'dependents_info', 'document_upload',
          'recruitment', 'accounting_commitment', 'disciplinary_committee', 'performance_review',
          'send_performance_review', 'archive_performance_review', 'job_group', 'commute_report'
      ];
      acc[perm.key] = supervisorPermissions.includes(perm.key);
      return acc;
    }, {} as UserPermissions),
  },
  guard: {
    label: 'نگهبان',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      const guardPermissions: (keyof UserPermissions)[] = [
          'security', 'commuting_members', 'log_commute', 'commute_report'
      ];
      acc[perm.key] = guardPermissions.includes(perm.key);
      return acc;
    }, {} as UserPermissions),
  },
  normal: {
    label: 'کاربر عادی',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      const normalPermissions: (keyof UserPermissions)[] = ['dashboard', 'personnel', 'personnel_list'];
      acc[perm.key] = normalPermissions.includes(perm.key);
      return acc;
    }, {} as UserPermissions),
  }
};


const SettingsPage: React.FC = () => {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const userPermissions: UserPermissions = currentUser.permissions || {};

    const [appName, setAppName] = useState(() => localStorage.getItem('appName') || 'سیستم جامع کارگزینی');
    const [appLogo, setAppLogo] = useState<string | null>(() => localStorage.getItem('appLogo'));
    const logoInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const userImportRef = useRef<HTMLInputElement>(null);
    
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    // User management state
    const [users, setUsers] = useState<AppUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);

    // Password change state
    const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

    const handleAppNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAppName(e.target.value);
    };

    const saveAppName = () => {
        localStorage.setItem('appName', appName);
        setStatus({ type: 'success', message: 'نام برنامه با موفقیت ذخیره شد.' });
        setTimeout(() => setStatus(null), 3000);
        window.dispatchEvent(new Event('storage'));
    };
    
    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                localStorage.setItem('appLogo', dataUrl);
                setAppLogo(dataUrl);
                setStatus({ type: 'success', message: 'لوگو با موفقیت تغییر کرد.' });
                setTimeout(() => setStatus(null), 3000);
                window.dispatchEvent(new Event('storage'));
            };
            reader.readAsDataURL(file);
        }
    };
    
    const removeLogo = () => {
        localStorage.removeItem('appLogo');
        setAppLogo(null);
        if (logoInputRef.current) logoInputRef.current.value = '';
        window.dispatchEvent(new Event('storage'));
    };

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    // --- Backup and Restore ---
    const handleCreateBackup = async () => {
        setStatus({ type: 'info', message: 'در حال ایجاد فایل پشتیبان... این عملیات ممکن است چند لحظه طول بکشد.' });
        try {
            const response = await fetch('/api/backup');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error);
            }
            const data = await response.json();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const date = new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
            link.download = `backup-${date}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setStatus({ type: 'success', message: 'فایل پشتیبان با موفقیت ایجاد و دانلود شد.' });
        } catch(error) {
            setStatus({ type: 'error', message: `خطا در ایجاد پشتیبان: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmation = window.prompt('این عمل تمام اطلاعات فعلی سیستم را با اطلاعات فایل پشتیبان جایگزین می‌کند و قابل بازگشت نیست. برای تایید، عبارت "بازیابی" را وارد کنید.');
        if (confirmation !== 'بازیابی') {
            if (backupInputRef.current) backupInputRef.current.value = "";
            return;
        }

        setStatus({ type: 'info', message: 'در حال خواندن فایل پشتیبان...' });
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target?.result as string);
                setStatus({ type: 'info', message: 'در حال ارسال اطلاعات به سرور برای بازیابی... لطفاً منتظر بمانید.' });
                const response = await fetch('/api/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(backupData)
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.details || result.error);
                }
                setStatus({ type: 'success', message: 'بازیابی اطلاعات با موفقیت انجام شد. صفحه مجدداً بارگذاری می‌شود.' });
                setTimeout(() => window.location.reload(), 2000);
            } catch (error) {
                 setStatus({ type: 'error', message: `خطا در بازیابی اطلاعات: ${error instanceof Error ? error.message : String(error)}` });
            } finally {
                if (backupInputRef.current) backupInputRef.current.value = "";
                setTimeout(() => setStatus(null), 8000);
            }
        };
        reader.readAsText(file);
    };

     const handleDeleteAllData = async () => {
        const confirmation = window.prompt('این عمل تمام اطلاعات پایگاه داده را حذف می‌کند و قابل بازگشت نیست. برای تایید، عبارت "حذف کلی" را وارد کنید.');
        if (confirmation !== 'حذف کلی') return;

        setStatus({ type: 'info', message: 'در حال حذف تمام اطلاعات...' });
        try {
            const response = await fetch('/api/backup', { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.details || result.error);
            setStatus({ type: 'success', message: 'تمام اطلاعات با موفقیت حذف شد. صفحه مجدداً بارگذاری می‌شود.' });
            setTimeout(() => window.location.reload(), 2000);
        } catch(error) {
            setStatus({ type: 'error', message: `خطا در حذف اطلاعات: ${error instanceof Error ? error.message : String(error)}` });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    // --- User Management Functions ---
    const fetchUsers = useCallback(async () => {
        setUsersLoading(true);
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data.users || []);
        } catch (error) {
            setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Error fetching users' });
        } finally {
            setUsersLoading(false);
        }
    }, []);

    useEffect(() => {
        if (userPermissions.user_management) {
            fetchUsers();
        }
    }, [userPermissions.user_management, fetchUsers]);

    const handleOpenUserModal = (user: AppUser | null) => {
        setEditingUser(user);
        setIsUserModalOpen(true);
    };

    const handleCloseUserModal = () => {
        setEditingUser(null);
        setIsUserModalOpen(false);
    };

    const handleSaveUser = async (user: AppUser) => {
        const isNew = !user.id;
        const method = isNew ? 'POST' : 'PUT';
        
        try {
            const response = await fetch('/api/users', {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `Failed to ${isNew ? 'create' : 'update'} user`);
            }
            setStatus({ type: 'success', message: `User ${isNew ? 'created' : 'updated'} successfully.` });
            handleCloseUserModal();
            fetchUsers();
        } catch (error) {
             setStatus({ type: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
        } finally {
            setTimeout(() => setStatus(null), 3000);
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                const response = await fetch('/api/users', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to delete user');
                }
                setStatus({ type: 'success', message: 'User deleted successfully.' });
                fetchUsers();
            } catch (error) {
                setStatus({ type: 'error', message: error instanceof Error ? error.message : 'An unknown error occurred' });
            } finally {
                setTimeout(() => setStatus(null), 3000);
            }
        }
    };

    const handleUserImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target?.result as ArrayBuffer), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const mappedUsers: Omit<AppUser, 'id'>[] = json.map((row: any) => ({
                    username: String(row['نام کاربری'] || ''),
                    password: String(row['رمز عبور'] || ''),
                    permissions: JSON.parse(row['دسترسی‌ها (JSON)'] || '{}')
                }));

                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedUsers)
                });
                 if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to import users');
                }
                setStatus({ type: 'success', message: 'Users imported successfully.' });
                fetchUsers();

            } catch (error) {
                 setStatus({ type: 'error', message: `Error importing users: ${error instanceof Error ? error.message : 'Unknown error'}` });
            } finally {
                if(userImportRef.current) userImportRef.current.value = "";
                 setTimeout(() => setStatus(null), 5000);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleUserExport = () => {
         const dataToExport = users.map(user => ({
            'نام کاربری': user.username,
            'رمز عبور': '', // Don't export passwords
            'دسترسی‌ها (JSON)': JSON.stringify(user.permissions, null, 2)
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
        XLSX.writeFile(workbook, 'Users_Export.xlsx');
    };
    
    const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setStatus({ type: 'error', message: 'رمز عبور جدید و تکرار آن مطابقت ندارند.' });
            return;
        }
        if (!passwordData.oldPassword || !passwordData.newPassword) {
            setStatus({ type: 'error', message: 'لطفاً تمام فیلدها را پر کنید.' });
            return;
        }

        setStatus({ type: 'info', message: 'در حال تغییر رمز عبور...' });
        try {
            const response = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    change_password: true,
                    username: currentUser.username,
                    oldPassword: passwordData.oldPassword,
                    newPassword: passwordData.newPassword,
                })
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error);
            }
            setStatus({ type: 'success', message: result.message });
            setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در تغییر رمز' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="space-y-8">
             {status && (
                <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`} role="alert">
                    {status.message}
                </div>
            )}
            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
                <h2 className="text-xl font-bold mb-4">تنظیمات ظاهری</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">نام برنامه</label>
                        <div className="flex items-center gap-2">
                            <input type="text" value={appName} onChange={handleAppNameChange} className="mt-1 block w-full md:w-1/3 p-2 border rounded-md" />
                            <button onClick={saveAppName} className="px-4 py-2 bg-blue-600 text-white rounded-md">ذخیره</button>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">لوگو برنامه</label>
                        <div className="flex items-center gap-4 mt-1">
                            {appLogo && <img src={appLogo} alt="App Logo" className="w-12 h-12 rounded-md object-cover" />}
                            <input type="file" ref={logoInputRef} onChange={handleLogoChange} className="hidden" id="logo-upload" accept="image/*" />
                            <label htmlFor="logo-upload" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md cursor-pointer hover:bg-gray-300">انتخاب فایل</label>
                            {appLogo && <button onClick={removeLogo} className="px-4 py-2 bg-red-100 text-red-700 rounded-md">حذف لوگو</button>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">پوسته</label>
                        <div className="mt-2 flex items-center gap-4">
                            <button onClick={() => setTheme('light')} className={`px-4 py-2 rounded-md ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>روشن</button>
                            <button onClick={() => setTheme('dark')} className={`px-4 py-2 rounded-md ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>تاریک</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
                <h2 className="text-xl font-bold mb-4">تغییر رمز عبور</h2>
                <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 max-w-sm">
                    <div>
                        <label className="block text-sm font-medium">رمز عبور فعلی</label>
                        <input type="password" value={passwordData.oldPassword} onChange={e => setPasswordData(p => ({...p, oldPassword: e.target.value}))} className="w-full p-2 border rounded-md" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">رمز عبور جدید</label>
                        <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData(p => ({...p, newPassword: e.target.value}))} className="w-full p-2 border rounded-md" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">تکرار رمز عبور جدید</label>
                        <input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData(p => ({...p, confirmPassword: e.target.value}))} className="w-full p-2 border rounded-md" required />
                    </div>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md">ذخیره رمز جدید</button>
                </form>
            </div>

            {userPermissions.user_management && (
                <>
                    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
                        <h2 className="text-xl font-bold mb-4">پشتیبان‌گیری و بازیابی</h2>
                         <div className="flex flex-wrap gap-4 items-center">
                             <button onClick={handleCreateBackup} className="px-4 py-2 bg-blue-600 text-white rounded-md">ایجاد فایل پشتیبان</button>
                             <input type="file" ref={backupInputRef} onChange={handleRestoreBackup} className="hidden" id="backup-restore" accept=".json" />
                             <label htmlFor="backup-restore" className="px-4 py-2 bg-green-600 text-white rounded-md cursor-pointer">بازیابی از فایل</label>
                             <button onClick={handleDeleteAllData} className="px-4 py-2 bg-red-600 text-white rounded-md">حذف تمام اطلاعات سیستم</button>
                        </div>
                    </div>
                    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl">
                        <h2 className="text-xl font-bold mb-4">مدیریت کاربران</h2>
                         <div className="flex flex-wrap gap-4 items-center mb-4">
                            <button onClick={() => handleOpenUserModal(null)} className="px-4 py-2 bg-blue-600 text-white rounded-md">افزودن کاربر جدید</button>
                            <input type="file" ref={userImportRef} onChange={handleUserImport} className="hidden" id="user-import" accept=".xlsx, .xls" />
                            <label htmlFor="user-import" className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"><UploadIcon className="w-4 h-4"/> ورود کاربران از اکسل</label>
                            <button onClick={handleUserExport} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"><DownloadIcon className="w-4 h-4"/> خروجی کاربران</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-right">نام کاربری</th><th className="px-6 py-3 text-center">عملیات</th></tr></thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {usersLoading ? <tr><td colSpan={2} className="text-center p-4">Loading...</td></tr> :
                                     users.map(user => (
                                         <tr key={user.id}>
                                             <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                                             <td className="px-6 py-4 whitespace-nowrap text-center">
                                                 <button onClick={() => handleOpenUserModal(user)} className="p-1 text-blue-600"><PencilIcon className="w-5 h-5"/></button>
                                                 <button onClick={() => handleDeleteUser(user.id)} className="p-1 text-red-600 mr-2"><TrashIcon className="w-5 h-5"/></button>
                                             </td>
                                         </tr>
                                     ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            {isUserModalOpen && <UserEditModal user={editingUser} onClose={handleCloseUserModal} onSave={handleSaveUser} />}
        </div>
    );
};

export default SettingsPage;