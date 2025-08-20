import React, { useState } from 'react';
import type { AppSettings } from '../types';
import { useSettings } from '../context/SettingsContext';
import { UploadIcon, DownloadIcon, DatabaseIcon } from './icons';
import saveAs from 'file-saver';

type SettingsTab = 'general' | 'backup';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { settings, updateSettings, isLoading: isSettingsLoading } = useSettings();
  
  const [appName, setAppName] = useState(settings?.app_name || '');
  const [appLogo, setAppLogo] = useState<string | null>(settings?.app_logo || null);

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

  const handleGeneralSettingsSave = async () => {
    try {
        await updateSettings({ app_name: appName, app_logo: appLogo });
        alert('تنظیمات با موفقیت ذخیره شد.');
    } catch (error) {
        alert('خطا در ذخیره سازی تنظیمات.');
    }
  };
  
  const handleBackup = async (scope: 'personnel' | 'users' | 'all') => {
      try {
        const response = await fetch(`/api/app-users?action=backup&scope=${scope}`);
        if (!response.ok) throw new Error('Failed to create backup');
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        saveAs(blob, `backup-${scope}-${new Date().toISOString().split('T')[0]}.json`);
      } catch(e) {
        alert('خطا در ایجاد فایل پشتیبان');
        console.error(e);
      }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('آیا اطمینان دارید؟ بازگردانی پشتیبان تمام داده‌های فعلی را حذف و بازنویسی خواهد کرد. این عمل غیرقابل بازگشت است.')) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            const data = JSON.parse(content);
            const response = await fetch('/api/app-users?action=restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to restore data');
            }
            alert('پشتیبان با موفقیت بازگردانی شد. صفحه مجددا بارگذاری می‌شود.');
            window.location.reload();
        } catch (err) {
            alert(`خطا در بازگردانی پشتیبان: ${err instanceof Error ? err.message : 'فایل نامعتبر است'}`);
            console.error(err);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
  };
  
  const renderGeneralSettings = () => (
    <div className="space-y-6">
        <div>
            <label htmlFor="appName" className="block text-sm font-medium text-gray-700 mb-1">نام برنامه</label>
            <input type="text" id="appName" value={appName} onChange={e => setAppName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">لوگوی برنامه</label>
            <div className="flex items-center gap-4">
                {appLogo && <img src={appLogo} alt="Logo preview" className="w-16 h-16 rounded-full object-cover" />}
                <input type="file" accept="image/*" onChange={handleLogoChange} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
        </div>
        <div className="flex justify-end">
            <button onClick={handleGeneralSettingsSave} disabled={isSettingsLoading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-blue-300">
                {isSettingsLoading ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
            </button>
        </div>
    </div>
  );

  const renderBackup = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Export Section */}
        <div className="space-y-4 p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center"><DownloadIcon className="w-5 h-5 ml-2" />خروج پشتیبان (Export)</h3>
            <p className="text-sm text-gray-600">از داده‌های خود در قالب فایل JSON خروجی بگیرید.</p>
            <div className="flex flex-col space-y-2">
                <button onClick={() => handleBackup('personnel')} className="w-full text-right px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition">خروج اطلاعات پرسنل</button>
                <button onClick={() => handleBackup('users')} className="w-full text-right px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition">خروج اطلاعات کاربران</button>
                <button onClick={() => handleBackup('all')} className="w-full text-right px-4 py-2 bg-blue-600 text-white font-semibold hover:bg-blue-700 rounded-md transition">خروج کامل (همه اطلاعات)</button>
            </div>
        </div>
        {/* Import Section */}
        <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
            <h3 className="text-lg font-semibold text-red-800 flex items-center"><UploadIcon className="w-5 h-5 ml-2" />ورود پشتیبان (Import)</h3>
            <p className="text-sm text-red-700">
                <span className="font-bold">هشدار:</span> بازگردانی فایل پشتیبان، تمام داده‌های فعلی را حذف و با اطلاعات فایل جایگزین می‌کند.
            </p>
            <div className="flex">
                <label className="w-full flex items-center justify-center bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition cursor-pointer">
                    <DatabaseIcon className="w-5 h-5 ml-2" />
                    انتخاب و بازگردانی فایل پشتیبان
                    <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
                </label>
            </div>
        </div>
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">تنظیمات</h1>
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 space-x-reverse px-6">
            <button onClick={() => setActiveTab('general')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'general' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              عمومی
            </button>
            <button onClick={() => setActiveTab('backup')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'backup' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              پشتیبان‌گیری
            </button>
          </nav>
        </div>
        <div className="p-6">
            {activeTab === 'general' && renderGeneralSettings()}
            {activeTab === 'backup' && renderBackup()}
        </div>
      </div>
    </div>
  );
};