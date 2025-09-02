import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AppUser, UserPermissions } from '../../types';
import UserEditModal from '../UserEditModal';
import { PencilIcon, TrashIcon, DownloadIcon, UploadIcon, DocumentReportIcon, UsersIcon } from '../icons/Icons';

declare const XLSX: any;

const PERMISSION_KEYS: { key: keyof UserPermissions, label: string }[] = [
    { key: 'dashboard', label: 'داشبورد' },
    { key: 'personnel', label: 'مدیریت پرسنل' },
    { key: 'recruitment', label: 'کارگزینی' },
    { key: 'security', label: 'حراست' },
    { key: 'settings', label: 'تنظیمات' },
    { key: 'user_management', label: 'مدیریت کاربران' },
];

const INDIVIDUAL_BACKUP_ITEMS = [
    { id: 'personnel', label: 'پرسنل', icon: UsersIcon, api: '/api/personnel?type=personnel', headers: ['کد پرسنلی', 'نام', 'نام خانوادگی', 'نام پدر', 'کد ملی', 'شماره شناسنامه', 'تاریخ تولد', 'محل تولد', 'تاریخ صدور', 'محل صدور', 'وضعیت تاهل', 'وضعیت نظام وظیفه', 'شغل', 'سمت', 'نوع استخدام', 'واحد', 'محل خدمت', 'تاریخ استخدام', 'مدرک تحصیلی', 'رشته تحصیلی', 'وضعیت'] },
    { id: 'dependents', label: 'بستگان', icon: UsersIcon, api: '/api/personnel?type=dependents', headers: ['کد پرسنلی', 'نوع وابستگی', 'نام', 'نام خانوادگی', 'کد ملی', 'تاریخ تولد', 'جنسیت'] },
    { id: 'commuting_members', label: 'اعضای تردد', icon: UsersIcon, api: '/api/personnel?type=commuting_members', headers: ['نام و نام خانوادگی', 'کد پرسنلی', 'واحد', 'سمت'] },
    { id: 'users', label: 'کاربران', icon: UsersIcon, api: '/api/users', headers: ['username', 'password', ...PERMISSION_KEYS.map(p => `perm_${p.key}`)] }
];

// Helper to export data to Excel
const exportToExcel = (data: any[], fileName: string, sheetName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

const SettingsPage: React.FC = () => {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const userPermissions: UserPermissions = currentUser.permissions || {};

    const [appName, setAppName] = useState(() => localStorage.getItem('appName') || 'سیستم جامع کارگزینی');
    const [appLogo, setAppLogo] = useState<string | null>(() => localStorage.getItem('appLogo'));
    const logoInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);
    const individualImportRefs = useRef<{[key: string]: HTMLInputElement | null}>({});
    
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

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
        } finally { setLoadingUsers(false); }
    }, [userPermissions.user_management]);

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
        localStorage.removeItem('appLogo');
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

    const handleExportAllData = async () => {
        setStatus({ type: 'info', message: 'در حال ایجاد نسخه پشتیبان کامل...' });
        try {
            const response = await fetch('/api/backup');
            if (!response.ok) throw new Error((await response.json()).details || 'خطا در دریافت داده‌ها');
            const data = await response.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            setStatus({ type: 'success', message: 'فایل پشتیبان کامل با موفقیت دانلود شد.' });
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ایجاد پشتیبان' });
        } finally { setTimeout(() => setStatus(null), 5000); }
    };
    
    const handleImportAllData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            setStatus({ type: 'info', message: 'در حال پردازش و بازیابی اطلاعات...' });
            try {
                const content = event.target?.result;
                const response = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: content });
                const data = await response.json();
                if (!response.ok) throw new Error(data.details || data.error);
                setStatus({ type: 'success', message: 'اطلاعات با موفقیت بازیابی شد. لطفاً برای مشاهده تغییرات از سیستم خارج و دوباره وارد شوید.' });
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در بازیابی اطلاعات' });
            } finally { if(backupInputRef.current) backupInputRef.current.value = ""; setTimeout(() => setStatus(null), 5000); }
        };
        reader.readAsText(file);
    };

    const handleDeleteAllData = async () => {
        if (window.prompt('این عمل تمام داده‌های سیستم را پاک می‌کند و قابل بازگشت نیست. برای تایید، عبارت "حذف کلی" را وارد کنید.') !== 'حذف کلی') {
            setStatus({ type: 'info', message: 'عملیات پاک کردن لغو شد.' });
            return;
        }
        setStatus({ type: 'info', message: 'در حال پاک کردن تمام داده‌ها...' });
        try {
            const response = await fetch('/api/backup', { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.details || data.error);
            setStatus({ type: 'success', message: 'تمام اطلاعات با موفقیت پاک شد. لطفاً از سیستم خارج شوید.' });
        } catch(err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در پاک کردن داده‌ها' });
        }
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

            {userPermissions.user_management && <UserEditModal user={editingUser} onClose={() => { setIsUserModalOpen(false); setEditingUser(null); }} onSave={async() => {}} />}

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
                        <button onClick={handleExportAllData} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                           <DownloadIcon className="w-5 h-5"/> تهیه پشتیبان
                        </button>
                        <input type="file" ref={backupInputRef} onChange={handleImportAllData} accept=".json" className="hidden" id="backup-import"/>
                        <label htmlFor="backup-import" className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 cursor-pointer">
                           <UploadIcon className="w-5 h-5"/> بازیابی از فایل
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">پشتیبان‌گیری و بازیابی مجزا (اکسل)</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    از هر بخش به صورت جداگانه خروجی اکسل تهیه کرده یا اطلاعات را از فایل اکسل استاندارد وارد سیستم کنید.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {INDIVIDUAL_BACKUP_ITEMS.map(item => (
                        <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <item.icon className="w-8 h-8 text-slate-500"/>
                                <span className="font-semibold text-gray-700 dark:text-gray-200">{item.label}</span>
                            </div>
                             <div className="flex items-center gap-2">
                                <button className="px-3 py-1.5 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200">خروجی اکسل</button>
                                {/* FIX: Wrap ref assignment in a block to ensure void return type. */}
                                <input type="file" ref={el => { individualImportRefs.current[item.id] = el; }} accept=".xlsx, .xls" className="hidden" id={`import-${item.id}`}/>
                                <label htmlFor={`import-${item.id}`} className="px-3 py-1.5 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 cursor-pointer">ورود از اکسل</label>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-red-800 dark:text-red-300">منطقه خطر</h2>
                <p className="text-sm text-red-700 dark:text-red-300 mt-2 mb-4">عملیات زیر غیرقابل بازگشت هستند. لطفاً با احتیاط کامل اقدام کنید.</p>
                <button onClick={handleDeleteAllData} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">پاک کردن تمام اطلاعات</button>
            </div>
        </div>
    );
};

export default SettingsPage;