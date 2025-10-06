import React, { useState, useEffect } from 'react';
import type { AppUser, UserPermissions, BonusPermissionFilters } from '../types';

interface UserEditModalProps {
  user: AppUser | null;
  onClose: () => void;
  onSave: (user: AppUser) => Promise<void>;
}

const PERMISSION_KEYS: { key: keyof UserPermissions, label: string }[] = [
    { key: 'dashboard', label: 'داشبورد' },
    { key: 'personnel', label: 'منوی مدیریت پرسنل' },
    { key: 'personnel_list', label: ' - لیست پرسنل' },
    { key: 'dependents_info', label: ' - اطلاعات بستگان' },
    { key: 'document_upload', label: ' - بارگذاری مدارک' },
    { key: 'recruitment', label: 'منوی کارگزینی' },
    { key: 'accounting_commitment', label: ' - نامه تعهد (صدور و بایگانی)' },
    { key: 'disciplinary_committee', label: ' - کمیته تشویق و انضباطی' },
    { key: 'performance_review', label: ' - ارزیابی عملکرد' },
    { key: 'send_performance_review', label: '   - ارسال ارزیابی عملکرد پرسنل' },
    { key: 'archive_performance_review', label: '   - بایگانی ارزیابی عملکرد پرسنل' },
    { key: 'job_group', label: ' - گروه شغلی پرسنل' },
    { key: 'bonus_management', label: ' - مدیریت کارانه' },
    { key: 'enter_bonus', label: '   - ارسال کارانه' },
    { key: 'bonus_analyzer', label: '   - تحلیلگر هوشمند کارانه' },
    { key: 'security', label: 'منوی حراست' },
    { key: 'commuting_members', label: ' - کارمندان عضو تردد' },
    { key: 'log_commute', label: ' - ثبت تردد' },
    { key: 'commute_report', label: ' - گزارش گیری تردد' },
    { key: 'settings', label: 'تنظیمات' },
    { key: 'user_management', label: 'مدیریت کاربران (در تنظیمات)' },
];

const PERMISSION_ROLES: { [key: string]: { label: string; permissions: UserPermissions } } = {
  admin: {
    label: 'دسترسی کامل (ادمین)',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      acc[perm.key] = true;
      return acc;
    }, {} as UserPermissions),
  },
  supervisor: {
    label: 'سرپرست',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      const supervisorPermissions: (keyof UserPermissions)[] = [
          'dashboard', 'personnel', 'personnel_list', 'dependents_info', 'document_upload',
          'recruitment', 'accounting_commitment', 'disciplinary_committee', 'performance_review',
          'send_performance_review', 'archive_performance_review', 'job_group', 'commute_report'
      ];
      acc[perm.key] = supervisorPermissions.includes(perm.key);
      return acc;
    }, {} as UserPermissions),
  },
  guard: {
    label: 'نگهبان',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      const guardPermissions: (keyof UserPermissions)[] = [
          'security', 'commuting_members', 'log_commute', 'commute_report'
      ];
      acc[perm.key] = guardPermissions.includes(perm.key);
      return acc;
    }, {} as UserPermissions),
  },
  normal: {
    label: 'کاربر عادی',
    permissions: PERMISSION_KEYS.reduce((acc, perm) => {
      const normalPermissions: (keyof UserPermissions)[] = ['dashboard', 'personnel', 'personnel_list'];
      acc[perm.key] = normalPermissions.includes(perm.key);
      return acc;
    }, {} as UserPermissions),
  }
};

const FilterCheckboxList: React.FC<{
    title: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
}> = ({ title, options, selected, onChange }) => {
    const handleToggle = (option: string) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    return (
        <div>
            <h5 className="font-semibold text-sm mb-2">{title}</h5>
            <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-white dark:bg-slate-800">
                {options.length === 0 && <p className="text-xs text-center text-gray-500">موردی یافت نشد.</p>}
                {options.map(option => (
                    <label key={option} className="flex items-center space-x-2 space-x-reverse cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        <input
                            type="checkbox"
                            checked={selected.includes(option)}
                            onChange={() => handleToggle(option)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm">{option}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};


const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<AppUser>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [distinctValues, setDistinctValues] = useState<{ departments: string[], positions: string[], service_locations: string[] }>({ departments: [], positions: [], service_locations: [] });
  
  const isNew = !user;

  useEffect(() => {
    setFormData(user || { username: '', password: '', permissions: { enter_bonus_filters: {} } });
  }, [user]);

  useEffect(() => {
    const fetchDistinctValues = async () => {
        try {
            const response = await fetch('/api/personnel?type=distinct_values');
            if(response.ok) {
                const data = await response.json();
                setDistinctValues(data);
            }
        } catch (error) {
            console.error("Failed to fetch distinct values for filters:", error);
        }
    };
    fetchDistinctValues();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (key: keyof UserPermissions) => {
    const newPermissions = { ...formData.permissions };
    newPermissions[key] = !newPermissions[key];

    if (key === 'enter_bonus' && !newPermissions[key]) {
        // If 'enter_bonus' is unchecked, clear its filters
        if (newPermissions.enter_bonus_filters) {
            newPermissions.enter_bonus_filters = {};
        }
    }

    setFormData(prev => ({
        ...prev,
        permissions: newPermissions
    }));
  };
  
  const handleBonusFilterChange = (filterType: keyof BonusPermissionFilters, selected: string[]) => {
      setFormData(prev => ({
          ...prev,
          permissions: {
              ...prev.permissions,
              enter_bonus_filters: {
                  ...prev.permissions?.enter_bonus_filters,
                  [filterType]: selected,
              }
          }
      }));
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roleKey = e.target.value;
    if (roleKey && PERMISSION_ROLES[roleKey]) {
        setFormData(prev => ({
            ...prev,
            permissions: PERMISSION_ROLES[roleKey].permissions,
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || (isNew && !formData.password)) {
        alert('نام کاربری و رمز عبور برای کاربر جدید الزامی است.');
        return;
    }
    setIsSaving(true);
    try {
      await onSave(formData as AppUser);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200";

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {isNew ? 'افزودن کاربر جدید' : `ویرایش کاربر ${user?.username}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">نام کاربری</label>
                  <input type="text" id="username" name="username" value={formData.username || ''} onChange={handleChange} className={inputClass} required />
                </div>
                 <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    رمز عبور {isNew ? '' : '(برای عدم تغییر، خالی بگذارید)'}
                  </label>
                  <input type="password" id="password" name="password" value={formData.password || ''} onChange={handleChange} className={inputClass} required={isNew} />
                </div>
                 <div className="sm:col-span-2">
                    <label htmlFor="role-select-modal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اعمال دسترسی گروهی (اختیاری)</label>
                    <select id="role-select-modal" onChange={handleRoleChange} className={inputClass} defaultValue="">
                        <option value="">-- انتخاب گروه دسترسی --</option>
                        {Object.entries(PERMISSION_ROLES).map(([key, role]) => (
                            <option key={key} value={key}>{role.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">دسترسی‌ها</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 dark:border-slate-600">
                    {PERMISSION_KEYS.map(perm => (
                        <div key={perm.key}>
                            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!formData.permissions?.[perm.key]}
                                    onChange={() => handlePermissionChange(perm.key)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200">{perm.label}</span>
                            </label>
                            {perm.key === 'enter_bonus' && formData.permissions?.enter_bonus && (
                                <div className="mt-2 p-3 border rounded-md bg-slate-100 dark:bg-slate-600 space-y-3 mr-6">
                                    <h5 className="text-xs font-bold">فیلترهای دسترسی کارانه:</h5>
                                    <FilterCheckboxList
                                        title="واحدها"
                                        options={distinctValues.departments}
                                        selected={formData.permissions.enter_bonus_filters?.departments || []}
                                        onChange={(selected) => handleBonusFilterChange('departments', selected)}
                                    />
                                     <FilterCheckboxList
                                        title="پست‌های سازمانی"
                                        options={distinctValues.positions}
                                        selected={formData.permissions.enter_bonus_filters?.positions || []}
                                        onChange={(selected) => handleBonusFilterChange('positions', selected)}
                                    />
                                     <FilterCheckboxList
                                        title="محل‌های خدمت"
                                        options={distinctValues.service_locations}
                                        selected={formData.permissions.enter_bonus_filters?.service_locations || []}
                                        onChange={(selected) => handleBonusFilterChange('service_locations', selected)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 dark:bg-slate-900/50 dark:border-slate-700 rounded-b-lg mt-auto">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-slate-600 dark:text-gray-200 dark:border-slate-500 dark:hover:bg-slate-500" disabled={isSaving}>
              انصراف
            </button>
            <button type="submit" className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : (isNew ? 'افزودن کاربر' : 'ذخیره تغییرات')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserEditModal;