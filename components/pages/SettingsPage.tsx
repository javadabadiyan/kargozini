import React, { useState } from 'react';
import { PencilIcon, TrashIcon } from '../icons/Icons';

type User = {
    id: number;
    username: string;
    permissions: string;
};

const SettingsPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([
        { id: 1, username: 'ادمین', permissions: 'مدیریت پرسنل، ثبت کارگزینی، برنامه، مدیریت کاربران' },
        { id: 2, username: 'نگهبانی', permissions: 'ثبت تردد' },
    ]);
    const [theme, setTheme] = useState('light');

    const handleAddUser = () => {
        alert('این قابلیت هنوز پیاده‌سازی نشده است.');
    };
    
    const handleEditUser = (id: number) => {
        alert(`ویرایش کاربر با شناسه ${id} هنوز پیاده‌سازی نشده است.`);
    };

    const handleDeleteUser = (id: number) => {
        if (window.confirm('آیا از حذف این کاربر اطمینان دارید؟')) {
            setUsers(prevUsers => prevUsers.filter(user => user.id !== id));
        }
    };
    
    const handleActionClick = (action: string) => {
        alert(`عملیات "${action}" هنوز پیاده‌سازی نشده است.`);
    };

    const handleDeleteAllData = () => {
        if (window.confirm('هشدار! این عمل تمام اطلاعات سیستم را به صورت دائمی حذف خواهد کرد و قابل بازگشت نیست. آیا اطمینان کامل دارید؟')) {
            alert('این قابلیت بسیار حساس هنوز پیاده‌سازی نشده است.');
        }
    };

    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">تنظیمات برنامه</h1>
                <p className="text-sm text-gray-500 mt-1">شخصی‌سازی، مدیریت کاربران و داده‌های برنامه</p>
            </div>
            
            {/* Main Settings */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 border-b pb-3 mb-4">تنظیمات اصلی</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="app-name" className="block text-sm font-medium text-gray-700 mb-1">نام برنامه</label>
                        <input type="text" id="app-name" defaultValue="سامانه حضور و غیاب" className={inputClass} />
                    </div>
                    <div>
                        <label htmlFor="app-logo" className="block text-sm font-medium text-gray-700 mb-1">لوگوی برنامه</label>
                        <input type="text" id="app-logo" placeholder="تغییر آیکون" className={inputClass} />
                    </div>
                </div>
            </div>

            {/* User Management */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-xl font-bold text-gray-700">مدیریت کاربران</h2>
                    <button onClick={handleAddUser} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        + افزودن کاربر
                    </button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">نام کاربری</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase">دسترسی‌ها</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{user.username}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{user.permissions}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleEditUser(user.id)} className="p-1 text-blue-600 hover:text-blue-800"><PencilIcon className="w-5 h-5" /></button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="p-1 text-red-600 hover:text-red-800"><TrashIcon className="w-5 h-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Appearance */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-gray-700 border-b pb-3 mb-4">تغییر ظاهر</h2>
                 <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">حالت نمایش:</span>
                    <div className="flex items-center gap-2 p-1 bg-slate-200 rounded-lg">
                        <button onClick={() => setTheme('light')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${theme === 'light' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>روشن</button>
                        <button onClick={() => setTheme('dark')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${theme === 'dark' ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>تیره</button>
                    </div>
                </div>
            </div>
            
             {/* Backup and Recovery */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                 <h2 className="text-xl font-bold text-gray-700 border-b pb-3 mb-4">پشتیبان‌گیری و بازیابی</h2>
                 <div className="space-y-6">
                    <div className="p-4 border rounded-lg bg-blue-50 text-blue-800">
                        <h3 className="font-bold">پشتیبان‌گیری جامع (پیشنهادی)</h3>
                        <p className="text-sm mt-1">ایجاد یک فایل پشتیبان جامع شامل تمامی اطلاعات برنامه (پرسنل، ترددها، کاربران و تنظیمات) که برای انتقال به یک سیستم دیگر یا بایگانی کردن کل اطلاعات به کار می‌رود.</p>
                        <div className="flex gap-4 mt-3">
                            <button onClick={() => handleActionClick('تهیه پشتیبان جامع')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">تهیه پشتیبان جامع</button>
                            <button onClick={() => handleActionClick('بازیابی از فایل جامع')} className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-200">بازیابی از فایل جامع</button>
                        </div>
                    </div>
                     <div>
                        <h3 className="font-bold text-gray-600">پشتیبان‌گیری مجزا (پیشرفته)</h3>
                        <p className="text-sm text-gray-500 mt-1">از گزینه‌های زیر فقط در صورتی استفاده کنید که می‌خواهید اطلاعات یک بخش خاص را به صورت جداگانه دستکاری یا بازیابی کنید. توجه: عملیات بازیابی در این بخش، داده‌های همان بخش را به طور کامل پاک و با فایل جدید جایگزین می‌کند.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                            {['داده‌های پرسنل', 'رکوردهای تردد', 'کاربران و دسترسی‌ها', 'تنظیمات برنامه'].map(item => (
                                <div key={item} className="p-3 border rounded-lg flex justify-between items-center">
                                    <span className="font-medium text-sm">{item}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleActionClick(`خروجی ${item}`)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">خروجی</button>
                                        <button onClick={() => handleActionClick(`ورودی ${item}`)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">ورودی</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                 </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
                    <h3 className="text-lg font-bold text-red-800">منطقه خطر</h3>
                    <p className="text-sm text-red-700 mt-2">این عملیات غیرقابل برگشت است. لطفا با احتیاط کامل اقدام کنید.</p>
                    <div className="mt-4">
                        <button onClick={handleDeleteAllData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">پاک کردن تمام اطلاعات</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;