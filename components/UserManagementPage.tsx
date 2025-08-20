import React, { useState, useEffect } from 'react';
import type { User } from '../types';
import { PlusIcon, EditIcon, DeleteIcon, UploadIcon, DownloadIcon, LockIcon, CloseIcon } from './icons';
import * as XLSX from 'xlsx';

const ALL_PERMISSIONS = [
    { name: 'manage_personnel', description: 'افزودن، ویرایش و حذف پرسنل' },
    { name: 'manage_users', description: 'مدیریت کاربران و دسترسی‌های آنها' },
    { name: 'manage_settings', description: 'تغییر تنظیمات کلی برنامه' },
    { name: 'perform_backup', description: 'ایجاد و بازگردانی پشتیبان' },
];

interface UserManagementPageProps {
  users: User[];
  onUsersChange: () => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({ users, onUsersChange }) => {
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);

    const handleOpenUserModal = (user: User | null = null) => {
        setUserToEdit(user);
        setIsUserModalOpen(true);
    };

    const handleCloseUserModal = () => {
        setIsUserModalOpen(false);
        setUserToEdit(null);
    };

    const handleOpenPasswordModal = (user: User) => {
        setUserToEdit(user);
        setIsPasswordModalOpen(true);
    };

    const handleClosePasswordModal = () => {
        setIsPasswordModalOpen(false);
        setUserToEdit(null);
    };

    const handleDownloadSample = () => {
        const headers = [
            'نام', 'نام خانوادگی', 'نام کاربری', 'رمز عبور',
            ...ALL_PERMISSIONS.map(p => `دسترسی: ${p.description}`)
        ];
        
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        XLSX.writeFile(wb, 'نمونه_ورود_کاربران.xlsx');
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
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    alert('فایل اکسل خالی است.');
                    return;
                }
                
                const permissionHeaderMap = ALL_PERMISSIONS.reduce((acc, p) => {
                    acc[`دسترسی: ${p.description}`] = p.name;
                    return acc;
                }, {} as Record<string, string>);

                const mappedUsers = json.map(row => {
                    const permissions: string[] = [];
                    for (const header in row) {
                        const permissionKey = permissionHeaderMap[header];
                        if (permissionKey && ['بله', 'yes', 'true', '1', 1].includes(String(row[header]).toLowerCase())) {
                            permissions.push(permissionKey);
                        }
                    }
                    
                    return {
                        firstName: row['نام'] || '',
                        lastName: row['نام خانوادگی'] || '',
                        username: row['نام کاربری'] || '',
                        password: row['رمز عبور'] || '',
                        permissions: permissions
                    };
                });


                const response = await fetch('/api/users?module=admin&action=import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedUsers),
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to import users');
                }
                alert(`${json.length} کاربر با موفقیت وارد شدند.`);
                onUsersChange();
            } catch (error) {
                alert(`خطا در ورود کاربران: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDeleteUser = async (userId: number) => {
        if (window.confirm('آیا از حذف این کاربر اطمینان دارید؟')) {
            try {
                const response = await fetch(`/api/users?module=admin&id=${userId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Failed to delete user');
                onUsersChange();
            } catch (error) {
                alert('خطا در حذف کاربر.');
            }
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-semibold text-gray-700">مدیریت کاربران</h1>
                <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
                    <button onClick={handleDownloadSample} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
                        <DownloadIcon className="w-5 h-5 ml-2" /> دانلود نمونه
                    </button>
                    <label className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition cursor-pointer">
                        <UploadIcon className="w-5 h-5 ml-2" /> ورود با اکسل
                        <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
                    </label>
                    <button onClick={() => handleOpenUserModal()} className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
                        <PlusIcon className="w-5 h-5 ml-2" /> افزودن کاربر
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام خانوادگی</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نام کاربری</th>
                            <th className="relative px-6 py-3"><span className="sr-only">عملیات</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.firstName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.lastName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-4 space-x-reverse">
                                        <button onClick={() => handleOpenPasswordModal(user)} className="text-gray-500 hover:text-gray-800 transition" title="تغییر رمز عبور"><LockIcon className="w-5 h-5" /></button>
                                        <button onClick={() => handleOpenUserModal(user)} className="text-indigo-600 hover:text-indigo-900 transition" title="ویرایش"><EditIcon /></button>
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900 transition" title="حذف"><DeleteIcon /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isUserModalOpen && <UserModal user={userToEdit} onClose={handleCloseUserModal} onSave={onUsersChange} />}
            {isPasswordModalOpen && <PasswordModal user={userToEdit!} onClose={handleClosePasswordModal} />}
        </div>
    );
};

// User Add/Edit Modal
const UserModal = ({ user, onClose, onSave }: { user: User | null, onClose: () => void, onSave: () => void }) => {
    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        username: user?.username || '',
        password: '',
        permissions: user?.permissions || []
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePermissionChange = (permission: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            permissions: checked ? [...prev.permissions, permission] : prev.permissions.filter(p => p !== permission)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const body = user ? { ...formData, id: user.id } : formData;
        try {
            const response = await fetch('/api/users?module=admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to save user');
            }
            onSave();
            onClose();
        } catch (error) {
            alert(`خطا در ذخیره کاربر: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-down max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">{user ? 'ویرایش کاربر' : 'افزودن کاربر'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="نام" required className="p-2 border rounded" />
                        <input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="نام خانوادگی" required className="p-2 border rounded" />
                        <input name="username" value={formData.username} onChange={handleChange} placeholder="نام کاربری" required className="p-2 border rounded" />
                        <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder={user ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} required={!user} className="p-2 border rounded" />
                    </div>
                    <div className="mb-4">
                        <h3 className="font-semibold mb-2">دسترسی‌ها</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ALL_PERMISSIONS.map(p => (
                                <label key={p.name} className="flex items-center space-x-2 space-x-reverse p-2 bg-gray-50 rounded">
                                    <input type="checkbox" checked={formData.permissions.includes(p.name)} onChange={e => handlePermissionChange(p.name, e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    <span>{p.description}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">انصراف</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">ذخیره</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Change Password Modal
const PasswordModal = ({ user, onClose }: { user: User, onClose: () => void }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            alert('رمزهای عبور مطابقت ندارند.');
            return;
        }
        if (password.length < 6) {
            alert('رمز عبور باید حداقل ۶ کاراکتر باشد.');
            return;
        }
        try {
            const response = await fetch('/api/users?module=admin&action=change_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, password }),
            });
            if (!response.ok) throw new Error('Failed to change password');
            alert('رمز عبور با موفقیت تغییر کرد.');
            onClose();
        } catch (error) {
            alert('خطا در تغییر رمز عبور.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative animate-fade-in-down">
                 <button onClick={onClose} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800"><CloseIcon/></button>
                <h2 className="text-xl font-bold mb-4">تغییر رمز عبور برای {user.username}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="رمز عبور جدید" required className="w-full p-2 border rounded" />
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="تکرار رمز عبور جدید" required className="w-full p-2 border rounded" />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">انصراف</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">تغییر رمز</button>
                    </div>
                </form>
            </div>
        </div>
    );
};