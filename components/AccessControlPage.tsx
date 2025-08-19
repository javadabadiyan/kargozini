
import React, { useState, useEffect } from 'react';
import type { Role } from '../types';
import { DeleteIcon, PlusIcon } from './icons';

const ALL_PERMISSIONS = [
    { name: 'manage_personnel', description: 'افزودن، ویرایش و حذف پرسنل' },
    { name: 'view_personnel', description: 'مشاهده لیست پرسنل' },
    { name: 'manage_roles', description: 'ایجاد و حذف نقش‌ها' },
    { name: 'manage_access_control', description: 'تخصیص دسترسی به نقش‌ها' },
    { name: 'manage_settings', description: 'تغییر تنظیمات کلی برنامه' },
    { name: 'perform_backup', description: 'ایجاد و بازگردانی پشتیبان' },
];

interface AccessControlPageProps {
  roles: Role[];
  onRolesChange: () => void;
}

export const AccessControlPage: React.FC<AccessControlPageProps> = ({ roles, onRolesChange }) => {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  useEffect(() => {
    if (roles.length > 0) {
      if (!selectedRoleId || !roles.some(r => r.id === selectedRoleId)) {
        setSelectedRoleId(roles[0].id);
      }
    } else {
      setSelectedRoleId(null);
    }
  }, [roles]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!selectedRoleId) {
        setRolePermissions([]);
        return;
      };
      setIsLoading(true);
      try {
        const response = await fetch(`/api/access?roleId=${selectedRoleId}`);
        if (!response.ok) throw new Error('Failed to fetch permissions');
        const data = await response.json();
        setRolePermissions(data.permissions || []);
      } catch (error) {
        console.error(error);
        alert('خطا در دریافت لیست دسترسی‌ها.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPermissions();
  }, [selectedRoleId]);
  
  const handlePermissionChange = (permissionName: string, checked: boolean) => {
    setRolePermissions(prev => 
        checked 
        ? [...prev, permissionName] 
        : prev.filter(p => p !== permissionName)
    );
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    setIsLoading(true);
    try {
        const response = await fetch('/api/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId: selectedRoleId, permissions: rolePermissions }),
        });
        if (!response.ok) throw new Error('Failed to save permissions');
        alert('دسترسی‌ها با موفقیت ذخیره شد.');
    } catch (error) {
        console.error(error);
        alert('خطا در ذخیره‌سازی دسترسی‌ها.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      alert('نام نقش نمی‌تواند خالی باشد.');
      return;
    }
    setIsSubmittingRole(true);
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoleName }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to add role');
      }
      setNewRoleName('');
      onRolesChange(); // Re-fetch roles
    } catch (error) {
      console.error(error);
      alert(`خطا در افزودن نقش: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsSubmittingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (window.confirm('آیا از حذف این نقش اطمینان دارید؟ تمام دسترسی‌های این نقش نیز حذف خواهد شد.')) {
      try {
        const response = await fetch(`/api/roles?id=${roleId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete role');
        onRolesChange();
      } catch (error) {
        console.error(error);
        alert('خطا در حذف نقش.');
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">مدیریت دسترسی نقش‌ها</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="col-span-1 border-l border-gray-200 pl-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">نقش‌ها</h2>
             <form onSubmit={handleAddRole} className="flex items-center space-x-2 space-x-reverse mb-4">
                <input 
                    type="text" 
                    value={newRoleName} 
                    onChange={(e) => setNewRoleName(e.target.value)} 
                    placeholder="نام نقش جدید" 
                    className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
                />
                <button 
                    type="submit" 
                    disabled={isSubmittingRole} 
                    className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-blue-300"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
            </form>
            <div className="space-y-2">
              {roles.map(role => (
                <div key={role.id} className="flex items-center justify-between group bg-gray-50 rounded-md">
                    <button
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`flex-grow text-right px-4 py-2 rounded-md transition ${selectedRoleId === role.id ? 'bg-blue-600 text-white' : 'bg-transparent hover:bg-gray-200'}`}
                    >
                    {role.name}
                    </button>
                    <button 
                        onClick={() => handleDeleteRole(role.id)} 
                        className="mr-2 p-2 text-gray-400 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                        title="حذف نقش"
                    >
                        <DeleteIcon />
                    </button>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions List */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
                {selectedRoleId ? `دسترسی‌های نقش '${roles.find(r => r.id === selectedRoleId)?.name}'` : 'یک نقش را انتخاب کنید'}
            </h2>
            {isLoading ? (
                <p>در حال بارگذاری دسترسی‌ها...</p>
            ) : selectedRoleId ? (
                <div className="space-y-4">
                    {ALL_PERMISSIONS.map(permission => (
                        <label key={permission.name} className="flex items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition">
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                                checked={rolePermissions.includes(permission.name)}
                                onChange={e => handlePermissionChange(permission.name, e.target.checked)}
                            />
                            <div className="mr-3 text-sm">
                                <span className="font-medium text-gray-900">{permission.description}</span>
                                <p className="text-gray-500 text-xs">{permission.name}</p>
                            </div>
                        </label>
                    ))}
                    <div className="flex justify-end pt-4">
                        <button onClick={handleSavePermissions} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition" disabled={isLoading}>
                            ذخیره دسترسی‌ها
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500">
                    <p>برای تخصیص دسترسی، لطفا یک نقش را از لیست سمت راست انتخاب کنید.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
