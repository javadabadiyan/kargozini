import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AppUser, UserPermissions } from '../../types';
import { PERMISSION_STRUCTURE } from '../../types';
import UserEditModal from '../UserEditModal';
import { PencilIcon, TrashIcon, DownloadIcon, UploadIcon, DocumentReportIcon, UsersIcon } from '../icons/Icons';

declare const XLSX: any;

const INDIVIDUAL_BACKUP_ITEMS = [
    { id: 'personnel', label: 'پرسنل', api: '/api/personnel?type=personnel' },
    { id: 'dependents', label: 'بستگان', api: '/api/personnel?type=dependents' },
    { id: 'commuting_members', label: 'اعضای تردد', api: '/api/personnel?type=commuting_members' },
    { id: 'users', label: 'کاربران', api: '/api/users' },
    { id: 'commute_logs', label: 'ترددهای روزانه', api: '/api/commute-logs' },
    { id: 'hourly_commute_logs', label: 'ترددهای ساعتی', api: '/api/commute-logs?entity=hourly' },
];

const SettingsPage: React.FC = () => {
    const [appName, setAppName] = useState(() => localStorage.getItem('appName') || 'سیستم جامع کارگزینی');
    const [appLogo, setAppLogo] = useState<string | null>(() => localStorage.getItem('appLogo'));
    const logoInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const individualBackupRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    const [users, setUsers] = useState<AppUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | null>(null);

    const [showAddUserForm, setShowAddUserForm] = useState(false);
    const [newUser, setNewUser] = useState<Omit<AppUser, 'id'>>({
        username: '',
        password: '',
        permissions: {},
    });

    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data.users || []);
        } catch (error) {
            setStatus({ type: 'error', message: 'خطا در دریافت لیست کاربران' });
        } finally { setLoadingUsers(false); }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { if (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark'); }, []);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => setAppLogo(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteLogo = () => {
        setAppLogo(null);
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

    const handleBackup = async (type: 'all' | 'personnel' | 'dependents' | 'commuting_members' | 'users' | 'commute_logs' | 'hourly_commute_logs') => {
        setStatus({ type: 'info', message: 'در حال ایجاد نسخه پشتیبان...' });
        try {
            const endpoint = type === 'all' ? '/api/backup' : `/api/backup?table=${type}`;
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error((await response.json()).details || 'خطا در دریافت داده‌ها');
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${type}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setStatus({ type: 'success', message: 'فایل پشتیبان با موفقیت دانلود شد.' });
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ایجاد پشتیبان' });
        } finally { setTimeout(() => setStatus(null), 5000); }
    };
    
    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>, type: 'all' | 'personnel' | 'dependents' | 'commuting_members' | 'users' | 'commute_logs' | 'hourly_commute_logs') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            setStatus({ type: 'info', message: 'در حال پردازش و بازیابی اطلاعات...' });
            try {
                const content = event.target?.result;
                const endpoint = type === 'all' ? '/api/backup' : `/api/backup?table=${type}`;
                const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: content });
                const data = await response.json();
                if (!response.ok) throw new Error(data.details || data.error);
                setStatus({ type: 'success', message: 'اطلاعات با موفقیت بازیابی شد. لطفاً برای مشاهده تغییرات از سیستم خارج و دوباره وارد شوید.' });
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در بازیابی اطلاعات' });
            } finally { 
                if (type === 'all' && backupInputRef.current) backupInputRef.current.value = "";
                else if (individualBackupRefs.current[type]) individualBackupRefs.current[type]!.value = "";
                setTimeout(() => setStatus(null), 5000);
            }
        };
        reader.readAsText(file);
    };

    const handleSaveUser = async (user: Partial<AppUser>) => {
        const isNew = !user.id;
        const method = isNew ? 'POST' : 'PUT';
        const url = '/api/users';

        if (isNew && (!user.username || !user.password)) {
            setStatus({ type: 'error', message: 'نام کاربری و رمز عبور برای کاربر جدید الزامی است.' });
            return;
        }

        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setStatus({ type: 'success', message: data.message });
            if (isNew) {
                setShowAddUserForm(false);
                setNewUser({ username: '', password: '', permissions: {} });
            } else {
                setIsUserModalOpen(false);
                setEditingUser(null);
            }
            fetchUsers();
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره کاربر' });
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (window.confirm('آیا از حذف این کاربر اطمینان دارید؟')) {
            try {
                const response = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: userId }) });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: data.message });
                fetchUsers();
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف کاربر' });
            }
        }
    };
    
    const handleNewUserFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewUser(prev => ({ ...prev, [name]: value }));
    };

    const handleNewUserPermissionChange = (key: keyof UserPermissions) => {
        setNewUser(prev => ({
            ...prev,
            permissions: { ...prev.permissions, [key]: !prev.permissions?.[key] },
        }));
    };

    const handleAddNewUserSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSaveUser(newUser);
    };
    
    const statusColor = { info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">تنظیمات برنامه</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">شخصی‌سازی، مدیریت کاربران، ظاهر و داده‌های برنامه</p>
            </div>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">تنظیمات اصلی</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div>
                        <label htmlFor="app-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام برنامه</label>
                        <input type="text" id="app-name" value={appName} onChange={e => setAppName(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-md flex items-center justify-center overflow-hidden">
                            {appLogo ? <img src={appLogo} alt="پیش‌نمایش لوگو" className="w-full h-full object-cover"/> : <span className="text-xs text-gray-400">لوگو</span>}
                        </div>
                        <div className="flex-1 space-y-2">
                            <label htmlFor="app-logo-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300">لوگوی برنامه</label>
                            <div className="flex items-center gap-2">
                                <input type="file" id="app-logo-upload" accept="image/*" ref={logoInputRef} onChange={handleLogoChange} className="hidden" />
                                <label htmlFor="app-logo-upload" className="px-4 py-2 text-sm bg-gray-100 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-200 cursor-pointer dark:bg-slate-600 dark:text-gray-200 dark:border-slate-500">انتخاب فایل</label>
                                {appLogo && <button onClick={handleDeleteLogo} className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200">حذف لوگو</button>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSaveSettings} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">ذخیره تنظیمات</button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b dark:border-slate-700 pb-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">مدیریت کاربران</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setShowAddUserForm(prev => !prev)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            {showAddUserForm ? 'انصراف' : 'افزودن کاربر'}
                        </button>
                    </div>
                </div>
                
                {showAddUserForm && (
                    <form onSubmit={handleAddNewUserSubmit} className="p-4 mb-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-4 transition-all duration-300 ease-in-out">
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">افزودن کاربر جدید</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="new-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام کاربری</label>
                                <input type="text" id="new-username" name="username" value={newUser.username} onChange={handleNewUserFormChange} className={inputClass} required />
                            </div>
                            <div>
                                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">رمز عبور</label>
                                <input type="password" id="new-password" name="password" value={newUser.password || ''} onChange={handleNewUserFormChange} className={inputClass} required />
                            </div>
                        </div>
                        <div>
                            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">دسترسی‌ها</h4>
                            {PERMISSION_STRUCTURE.map(group => (
                                <div key={group.id} className="mb-3">
                                    <h5 className="font-semibold text-gray-600 dark:text-gray-400 mb-2">{group.label}</h5>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 p-4 border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600">
                                        {group.permissions.map(perm => (
                                            <label key={perm.key} className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                                                <input type="checkbox" checked={!!newUser.permissions?.[perm.key as keyof UserPermissions]} onChange={() => handleNewUserPermissionChange(perm.key as keyof UserPermissions)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                                <span className="text-sm text-gray-700 dark:text-gray-200">{perm.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end">
                            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700">افزودن</button>
                        </div>
                    </form>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">نام کاربری</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">دسترسی‌ها</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                            {loadingUsers ? (
                                <tr><td colSpan={3} className="text-center p-4">در حال بارگذاری...</td></tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">{user.username}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                                            {PERMISSION_STRUCTURE.flatMap(g => g.permissions).filter(p => user.permissions[p.key as keyof UserPermissions]).map(p => p.label).join('، ')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                            <button onClick={() => { setEditingUser(user); setIsUserModalOpen(true); }} className="p-1 text-blue-600 hover:text-blue-800" title="ویرایش"><PencilIcon className="w-5 h-5"/></button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="p-1 text-red-600 hover:text-red-800 mr-2" title="حذف"><TrashIcon className="w-5 h-5"/></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
             {isUserModalOpen && editingUser && <UserEditModal user={editingUser} onClose={() => { setIsUserModalOpen(false); setEditingUser(null); }} onSave={handleSaveUser} />}

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
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">پشتیبان‌گیری و بازیابی جامع</h2>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-300 max-w-lg">
                        از کل اطلاعات سیستم (شامل پرسنل، ترددها، کاربران و تنظیمات) یک فایل پشتیبان با فرمت JSON تهیه کنید یا اطلاعات را از یک فایل پشتیبان بازیابی نمایید.
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleBackup('all')} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                           <DownloadIcon className="w-5 h-5"/> تهیه پشتیبان
                        </button>
                        <input type="file" ref={backupInputRef} onChange={(e) => handleRestore(e, 'all')} accept=".json" className="hidden" id="backup-import"/>
                        <label htmlFor="backup-import" className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 cursor-pointer">
                           <UploadIcon className="w-5 h-5"/> بازیابی از فایل
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">پشتیبان‌گیری و بازیابی مجزا (JSON)</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    از هر بخش به صورت جداگانه خروجی JSON تهیه کرده یا اطلاعات را از فایل استاندارد وارد سیستم کنید.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {INDIVIDUAL_BACKUP_ITEMS.map(item => (
                        <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-700 dark:text-gray-200">{item.label}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <button onClick={() => handleBackup(item.id as any)} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200">تهیه پشتیبان</button>
                                <input type="file" ref={el => { individualBackupRefs.current[item.id] = el; }} onChange={(e) => handleRestore(e, item.id as any)} accept=".json" className="hidden" id={`import-${item.id}`}/>
                                <label htmlFor={`import-${item.id}`} className="px-3 py-1.5 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 cursor-pointer">بازیابی</label>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;