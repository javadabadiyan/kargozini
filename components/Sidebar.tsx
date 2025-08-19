import React from 'react';
import { UserIcon, SettingsIcon, LockIcon } from './icons';
import { useSettings } from '../context/SettingsContext';


type Page = 'users' | 'settings' | 'user-management';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const { settings } = useSettings();
  const navItems = [
    { id: 'users', label: 'مدیریت پرسنل', icon: UserIcon },
    { id: 'user-management', label: 'مدیریت کاربران', icon: LockIcon },
    { id: 'settings', label: 'تنظیمات', icon: SettingsIcon },
  ];

  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col fixed top-0 right-0">
      <div className="flex items-center justify-center h-20 border-b border-gray-700 px-4">
        {settings?.app_logo && <img src={settings.app_logo} alt="Logo" className="w-10 h-10 rounded-full ml-3 object-cover" />}
        <h1 className="text-xl font-bold truncate">{settings?.app_name || 'پنل کارگزینی'}</h1>
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActivePage(item.id as Page)}
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