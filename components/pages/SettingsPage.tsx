import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AppUser, UserPermissions } from '../../types';
import UserEditModal from '../UserEditModal';
import { PencilIcon, TrashIcon } from '../icons/Icons';

declare const XLSX: any;

const PERMISSION_KEYS: { key: keyof UserPermissions, label: string }[] = [
    { key: 'dashboard', label: 'داشبورد' },
    { key: 'personnel', label: 'مدیریت پرسنل' },
    { key: 'recruitment', label: 'کارگزینی' },
    { key: 'security', label: 'حراست' },
    { key: 'settings', label: 'تنظیمات' },
    { key: 'user_management', label: 'مدیریت کاربران' },
];

const SettingsPage: React.FC = () => {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const userPermissions: UserPermissions = currentUser.permissions || {};

    const [appName, setAppName] = useState(() => localStorage.getItem('appName') || 'سامانه حضور و غیاب');
    const [appLogo, setAppLogo] = useState<string | null>(() => localStorage.getItem('appLogo'));
    const logoInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const usersInputRef = useRef<HTMLInputElement>(null);

    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    // User Management State
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);

    const fetchUsers = useCallback(async () => {
        if (!userPermissions.user_management) return;
        setLoadingUsers(true);
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data.users || []);
        } catch (error) {
            setStatus({ type: 'error', message: 'خطا در دریافت لیست کاربران' });
        } finally {
            setLoadingUsers(false);
        }
    }, [userPermissions.user_management]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        if (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        }
    }, []);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setAppLogo(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
    
    const handleSaveSettings = () => {
        localStorage.setItem('appName', appName);
        if (appLogo) localStorage.setItem('appLogo', appLogo);
        else localStorage.removeItem('appLogo');
        setStatus({ type: 'success', message: 'تنظیمات ذخیره شد. صفحه برای اعمال کامل تغییرات مجدداً بارگذاری می‌شود...' });
        setTimeout(() => window.location.reload(), 1500);
    };

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    // User Management Handlers
    const handleSaveUser = async (user: AppUser) => {
        try {
            const isNew = !user.id;
            const response = await fetch('/api/users', {
                method: isNew ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.details || data.error);
            setStatus({ type: 'success', message: data.message });
            setIsUserModalOpen(false);
            setEditingUser(null);
            fetchUsers();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره کاربر' });
        }
    };
    
    const handleDeleteUser = async (userId: number) => {
        if (window.confirm('آیا از حذف این کاربر اطمینان دارید؟')) {
            try {
                const response = await fetch('/api/users', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: userId })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: data.message });
                fetchUsers();
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف کاربر' });
            }
        }
    };
    
    const handleDownloadUserSample = () => {
        const headers = ['username', 'password', ...PERMISSION_KEYS.map(p => `perm_${p.key}`)];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'نمونه کاربران');
        XLSX.writeFile(wb, 'Sample_Users.xlsx');
    };

    const handleUserImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const workbook = XLSX.read(new Uint8Array(event.target!.result as ArrayBuffer), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
                
                const usersToImport = json.map(row => {
                    const permissions: UserPermissions = {};
                    PERMISSION_KEYS.forEach(p => {
                        const key = `perm_${p.key}`;
                        permissions[p.key] = ['true', '1', 'بله', 'yes'].includes(String(row[key]).toLowerCase());
                    });
                    return { username: row.username, password: String(row.password), permissions };
                });

                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(usersToImport)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.details || data.error);
                setStatus({ type: 'success', message: data.message });
                fetchUsers();

            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پردازش فایل اکسل' });
            } finally {
                if(usersInputRef.current) usersInputRef.current.value = "";
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleExportAllData = async () => { /* ... (existing implementation) ... */ };
    const handleImportAllData = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (existing implementation) ... */ };
    const handleDeleteAllData = () => { /* ... (existing implementation) ... */ };

    const statusColor = { info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200";

    return (
        <div className="space-y-8">
            {isUserModalOpen && <UserEditModal user={editingUser} onClose={() => { setIsUserModalOpen(false); setEditingUser(null); }} onSave={handleSaveUser} />}
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">تنظیمات برنامه</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">شخصی‌سازی، مدیریت ظاهر و داده‌های برنامه</p>
            </div>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">تنظیمات اصلی</h2>
                {/* ... (existing app name and logo JSX) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div>
                        <label htmlFor="app-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام برنامه</label>
                        <input type="text" id="app-name" value={appName} onChange={e => setAppName(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-md flex items-center justify-center overflow-hidden">
                            {appLogo ? <img src={appLogo} alt="پیش‌نمایش لوگو" className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400">لوگو</span>}
                        </div>
                        <div className="flex-1">
                            <label htmlFor="app-logo-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">لوگوی برنامه</label>
                            <input type="file" id="app-logo-upload" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/40 dark:file:text-blue-300 dark:hover:file:bg-blue-900/60" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveSettings} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">ذخیره تنظیمات</button>
                </div>
            </div>

            {userPermissions.user_management && (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-center border-b dark:border-slate-700 pb-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">مدیریت کاربران</h2>
                    <div className="flex items-center gap-2 mt-2 md:mt-0">
                         <button onClick={handleDownloadUserSample} className="text-sm text-blue-600 hover:underline">دانلود نمونه</button>
                        <input type="file" ref={usersInputRef} onChange={handleUserImport} accept=".xlsx, .xls" className="hidden" id="users-import"/>
                        <label htmlFor="users-import" className="px-4 py-2 text-sm bg-gray-100 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-200 cursor-pointer">ورود از اکسل</label>
                        <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">افزودن کاربر</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-slate-700">
                           <tr>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">نام کاربری</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">دسترسی‌ها</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">عملیات</th>
                           </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 dark:bg-slate-800 dark:divide-slate-700">
                           {loadingUsers ? (
                                <tr><td colSpan={3} className="text-center p-4 text-gray-500 dark:text-gray-400">در حال بارگذاری کاربران...</td></tr>
                           ) : (
                                users.map(user => (
                                    <tr key={user.id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{user.username}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex flex-wrap gap-1">
                                                {PERMISSION_KEYS.filter(p => user.permissions[p.key]).map(p => (
                                                    <span key={p.key} className="text-xs bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200 px-2 py-0.5 rounded-full">{p.label}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                            <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="p-1 text-red-600 hover:bg-red-100 rounded-full mr-2"><TrashIcon className="w-5 h-5"/></button>
                                        </td>
                                    </tr>
                                ))
                           )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">تغییر ظاهر</h2>
                 <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">حالت نمایش:</span>
                    <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                        <button onClick={() => handleThemeChange('light')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${theme === 'light' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>روشن</button>
                        <button onClick={() => handleThemeChange('dark')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${theme === 'dark' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-white shadow' : 'text-gray-600 dark:text-gray-300'}`}>تیره</button>
                    </div>
                </div>
            </div>
            {/* Backup and Recovery and Danger Zone sections can be added here as they were before */}
        </div>
    );
};

export default SettingsPage;