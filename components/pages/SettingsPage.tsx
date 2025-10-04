import React, { useState, useEffect } from 'react';
import { CogIcon, UploadIcon } from '../icons/Icons';

const SettingsPage: React.FC = () => {
    const [appName, setAppName] = useState('');
    const [appLogo, setAppLogo] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');

    useEffect(() => {
        const savedName = localStorage.getItem('appName');
        const savedLogo = localStorage.getItem('appLogo');
        if (savedName) setAppName(savedName);
        if (savedLogo) setAppLogo(savedLogo);
    }, []);

    const handleSave = () => {
        localStorage.setItem('appName', appName);
        if (appLogo) {
            localStorage.setItem('appLogo', appLogo);
        }
        setStatus('تنظیمات با موفقیت ذخیره شد.');
        setTimeout(() => setStatus(''), 3000);
        // Optional: force a reload to see changes immediately in the sidebar
        window.location.reload();
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAppLogo(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleRemoveLogo = () => {
        setAppLogo(null);
        localStorage.removeItem('appLogo');
    };

    return (
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                <CogIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold">تنظیمات سیستم</h2>
            </div>
            
            {status && <div className="p-3 mb-4 text-sm rounded-lg bg-green-100 text-green-800">{status}</div>}

            <div className="space-y-6">
                <div>
                    <label htmlFor="appName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        عنوان سیستم
                    </label>
                    <input
                        type="text"
                        id="appName"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-slate-700 dark:border-slate-600"
                        placeholder="مثال: سیستم جامع کارگزینی"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        لوگوی سیستم
                    </label>
                    <div className="mt-1 flex items-center gap-4">
                        <span className="inline-block h-16 w-16 rounded-md overflow-hidden bg-gray-100 dark:bg-slate-700">
                            {appLogo ? (
                                <img src={appLogo} alt="لوگو" className="h-full w-full object-cover" />
                            ) : (
                                <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            )}
                        </span>
                        <label htmlFor="logo-upload" className="cursor-pointer bg-white dark:bg-slate-600 py-2 px-3 border border-gray-300 dark:border-slate-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-500">
                            <span>تغییر لوگو</span>
                            <input id="logo-upload" name="logo-upload" type="file" className="sr-only" onChange={handleLogoChange} accept="image/*"/>
                        </label>
                         {appLogo && <button onClick={handleRemoveLogo} className="py-2 px-3 text-sm text-red-600">حذف لوگو</button>}
                    </div>
                </div>

                <div className="pt-5">
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                        >
                            ذخیره تغییرات
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
