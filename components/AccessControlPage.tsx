import React, { useState, useEffect } from 'react';
import type { Role } from '../types';

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
}

export const AccessControlPage: React.FC<AccessControlPageProps> = ({ roles }) => {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!selectedRoleId) return;
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

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">مدیریت دسترسی نقش‌ها</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="col-span-1">
            <h2 className="text-lg font-bold text-gray-800 mb-4">نقش‌ها</h2>
            <div className="space-y-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full text-right px-4 py-2 rounded-md transition ${selectedRoleId === role.id ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  {role.name}
                </button>
              ))}
            </div>
          </div>

          {/* Permissions List */}
          <div className="col-span-2">
            <h2 className="text-lg font-bold text-gray-800 mb-4">دسترسی‌ها</h2>
            {isLoading ? (
                <p>در حال بارگذاری دسترسی‌ها...</p>
            ) : (
                <div className="space-y-4">
                    {ALL_PERMISSIONS.map(permission => (
                        <label key={permission.name} className="flex items-start p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
