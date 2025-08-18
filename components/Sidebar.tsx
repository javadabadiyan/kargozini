
import React from 'react';
import { UserIcon, SettingsIcon } from './icons';

interface SidebarProps {
  activePage: 'users' | 'settings';
  setActivePage: (page: 'users' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const navItems = [
    { id: 'users', label: 'مدیریت کاربران', icon: UserIcon },
    { id: 'settings', label: 'تنظیمات', icon: SettingsIcon },
  ];

  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col fixed top-0 right-0">
      <div className="flex items-center justify-center h-20 border-b border-gray-700">
        <h1 className="text-2xl font-bold">پنل کارگزینی</h1>
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActivePage(item.id as 'users' | 'settings')}
                className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${
                  activePage === item.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <item.icon className="w-6 h-6 ml-3" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
