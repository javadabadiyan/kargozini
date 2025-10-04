import React, { useState, useEffect } from 'react';
import type { AppUser } from '../types';
import { ALL_MENU_ITEMS } from './menuConfig';

interface UserEditModalProps {
    user: AppUser | null;
    onClose: () => void;
    onSave: (user: AppUser) => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<AppUser>>({});
    const [isSaving, setIsSaving] = useState(false);
    const isNew = !user?.id;

    useEffect(() => {
        setFormData(user || { permissions: {} });
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePermissionChange = (permissionId: string, checked: boolean) => {
        setFormData(prev => {
            const newPermissions = { ...prev.permissions, [permissionId]: checked };
            return { ...prev, permissions: newPermissions };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        onSave(formData as AppUser);
        // isSaving will be reset by parent component
    };
    
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-4 border-b">
                        <h3 className="text-xl font-semibold">{isNew ? 'افزودن کاربر جدید' : `ویرایش کاربر: ${user?.username}`}</h3>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                                <label className="block text-sm font-medium mb-1">نام کاربری</label>
                                <input type="text" name="username" value={formData.username || ''} onChange={handleChange} className={inputClass} required/>
                           </div>
                           <div>
                                <label className="block text-sm font-medium mb-1">رمز عبور {isNew ? '' : '(خالی بگذارید تا تغییر نکند)'}</label>
                                <input type="password" name="password" value={formData.password || ''} onChange={handleChange} className={inputClass} required={isNew} />
                           </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">نام کامل (اختیاری)</label>
                            <input type="text" name="full_name" value={formData.full_name || ''} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">دسترسی‌ها</h4>
                            <div className="space-y-2">
                                {ALL_MENU_ITEMS.map(item => (
                                    <div key={item.id} className="p-2 border rounded-md">
                                        <label className="flex items-center font-bold">
                                            <input type="checkbox" checked={!!formData.permissions?.[item.id]} onChange={e => handlePermissionChange(item.id, e.target.checked)} className="ml-2"/>
                                            {item.label}
                                        </label>
                                        {item.children && (
                                            <div className="mr-6 mt-2 space-y-1">
                                                {item.children.map(child => (
                                                    <label key={child.id} className="flex items-center text-sm">
                                                         <input type="checkbox" checked={!!formData.permissions?.[child.id]} onChange={e => handlePermissionChange(child.id, e.target.checked)} className="ml-2"/>
                                                         {child.label}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">انصراف</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md" disabled={isSaving}>{isSaving ? 'در حال ذخیره...' : 'ذخیره'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserEditModal;
