import React, { useState, useRef, useEffect } from 'react';

const SettingsPage: React.FC = () => {
    const [appName, setAppName] = useState(() => localStorage.getItem('appName') || 'سامانه حضور و غیاب');
    const [appLogo, setAppLogo] = useState<string | null>(() => localStorage.getItem('appLogo'));
    const logoInputRef = useRef<HTMLInputElement>(null);
    const backupInputRef = useRef<HTMLInputElement>(null);

    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        // Sync with system preference if no theme is set
        if (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            setTheme('dark');
        }
    }, []);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAppLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else if (file) {
            alert('لطفاً یک فایل تصویری معتبر انتخاب کنید.');
        }
    };
    
    const handleSaveSettings = () => {
        localStorage.setItem('appName', appName);
        if (appLogo) {
            localStorage.setItem('appLogo', appLogo);
        } else {
            localStorage.removeItem('appLogo');
        }
        setStatus({ type: 'success', message: 'تنظیمات ذخیره شد. صفحه برای اعمال کامل تغییرات مجدداً بارگذاری می‌شود...' });
        setTimeout(() => window.location.reload(), 1500);
    };

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handleExportAllData = async () => {
        setStatus({ type: 'info', message: 'در حال جمع‌آوری تمام اطلاعات برای پشتیبان‌گیری... این عملیات ممکن است کمی طول بکشد.' });
        try {
            const response = await fetch('/api/backup');
            if (!response.ok) throw new Error('خطا در دریافت اطلاعات از سرور');
            
            const data = await response.json();
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
            a.download = `backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setStatus({ type: 'success', message: 'فایل پشتیبان با موفقیت ایجاد و دانلود شد.' });
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ایجاد فایل پشتیبان' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleImportAllData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!window.confirm('هشدار! بازیابی اطلاعات از فایل پشتیبان، تمام داده‌های فعلی سیستم را حذف و با اطلاعات فایل جایگزین می‌کند. آیا از این کار اطمینان دارید؟')) {
            if(backupInputRef.current) backupInputRef.current.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                setStatus({ type: 'info', message: 'در حال پردازش و بازیابی اطلاعات... لطفاً منتظر بمانید.' });
                const content = event.target?.result;
                if (typeof content !== 'string') throw new Error('فایل نامعتبر است.');
                
                const data = JSON.parse(content);
                
                const response = await fetch('/api/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const resData = await response.json();
                if (!response.ok) throw new Error(resData.details || resData.error);
                
                setStatus({ type: 'success', message: 'اطلاعات با موفقیت بازیابی شد! برنامه مجدداً راه‌اندازی می‌شود...' });
                setTimeout(() => window.location.reload(), 2000);

            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در بازیابی اطلاعات از فایل' });
                setTimeout(() => setStatus(null), 8000);
            } finally {
                if(backupInputRef.current) backupInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const handleDeleteAllData = () => {
        if (window.confirm('هشدار! این عمل تمام اطلاعات سیستم را به صورت دائمی حذف خواهد کرد و قابل بازگشت نیست. آیا اطمینان کامل دارید؟')) {
            alert('این قابلیت بسیار حساس هنوز پیاده‌سازی نشده است.');
        }
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">تنظیمات برنامه</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">شخصی‌سازی، مدیریت ظاهر و داده‌های برنامه</p>
            </div>
            
            {status && (
                <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`} role="alert">
                  {status.message}
                </div>
            )}

            {/* Main Settings */}
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

            {/* Appearance */}
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
            
             {/* Backup and Recovery */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                 <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 border-b dark:border-slate-700 pb-3 mb-4">پشتیبان‌گیری و بازیابی</h2>
                 <div className="p-4 border rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                    <h3 className="font-bold">پشتیبان‌گیری جامع</h3>
                    <p className="text-sm mt-1">ایجاد یک فایل پشتیبان جامع شامل تمامی اطلاعات برنامه (پرسنل، ترددها، کاربران و تنظیمات) یا بازیابی اطلاعات از یک فایل پشتیبان.</p>
                    <div className="flex gap-4 mt-3">
                        <button onClick={handleExportAllData} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">تهیه پشتیبان جامع</button>
                        <input type="file" ref={backupInputRef} onChange={handleImportAllData} accept=".json" className="hidden" id="backup-import"/>
                        <label htmlFor="backup-import" className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-200 cursor-pointer dark:bg-slate-600 dark:text-gray-200 dark:border-slate-500 dark:hover:bg-slate-500">بازیابی از فایل</label>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 rounded-lg">
                    <h3 className="text-lg font-bold text-red-800 dark:text-red-300">منطقه خطر</h3>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-2">این عملیات غیرقابل برگشت است. لطفا با احتیاط کامل اقدام کنید.</p>
                    <div className="mt-4">
                        <button onClick={handleDeleteAllData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">پاک کردن تمام اطلاعات</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;