
import React, { useState } from 'react';
import type { Role } from '../types';
import { DeleteIcon, PlusIcon } from './icons';

interface SettingsPageProps {
  roles: Role[];
  onRolesChange: () => void; // Callback to re-fetch roles in parent
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ roles, onRolesChange }) => {
  const [newRoleName, setNewRoleName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      alert('نام نقش نمی‌تواند خالی باشد.');
      return;
    }
    setIsSubmitting(true);
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
        setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (window.confirm('آیا از حذف این نقش اطمینان دارید؟ کاربرانی که این نقش را دارند، بی‌نقش خواهند شد.')) {
      try {
        const response = await fetch(`/api/roles?id=${roleId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete role');
        }
        onRolesChange(); // Re-fetch roles
      } catch (error) {
        console.error(error);
        alert('خطا در حذف نقش.');
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">تنظیمات</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">مدیریت نقش‌ها</h2>
        
        {/* Add Role Form */}
        <form onSubmit={handleAddRole} className="flex items-center space-x-2 space-x-reverse mb-6">
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="نام نقش جدید"
            className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:bg-blue-300"
          >
            <PlusIcon className="w-5 h-5 ml-2" />
            {isSubmitting ? 'در حال افزودن...' : 'افزودن نقش'}
          </button>
        </form>

        {/* Roles List */}
        <div className="space-y-3">
            {roles.length > 0 ? (
                roles.map((role) => (
                    <div key={role.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                        <span className="text-gray-700 font-medium">{role.name}</span>
                        <button onClick={() => handleDeleteRole(role.id)} className="text-red-500 hover:text-red-700 transition">
                            <DeleteIcon />
                        </button>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-500 py-4">هیچ نقشی تعریف نشده است.</p>
            )}
        </div>
      </div>
    </div>
  );
};
