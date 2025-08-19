import React from 'react';

export const AccessControlPage: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-700 mb-6">مدیریت دسترسی</h1>
      <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">
              مدیریت دسترسی مبتنی بر نقش با سیستم جدید "مدیریت کاربران" جایگزین شده است.
              <br/>
              لطفا برای مدیریت کاربران و دسترسی‌های آن‌ها از منوی "مدیریت کاربران" استفاده کنید.
          </p>
      </div>
    </div>
  );
};
