import React from 'react';
import { UserIcon, UsersIcon } from './icons';

interface DashboardViewProps {
  personnelCount: number;
  userCount: number;
}

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-white rounded-xl shadow-md p-6 flex items-center space-x-4 space-x-reverse border border-slate-200">
    <div className="bg-blue-100 p-4 rounded-full">
      {icon}
    </div>
    <div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <p className="text-3xl font-bold text-slate-800">{value.toLocaleString('fa-IR')}</p>
    </div>
  </div>
);


export const DashboardView: React.FC<DashboardViewProps> = ({ personnelCount, userCount }) => {
  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-bold text-slate-700 mb-6">داشبورد</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
            title="تعداد کل پرسنل" 
            value={personnelCount} 
            icon={<UserIcon className="w-8 h-8 text-blue-600" />} 
        />
        <StatCard 
            title="تعداد کاربران سیستم" 
            value={userCount} 
            icon={<UsersIcon className="w-8 h-8 text-blue-600" />}
        />
      </div>
    </div>
  );
};