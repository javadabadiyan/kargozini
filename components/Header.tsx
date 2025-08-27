
import React from 'react';
import { LogoutIcon } from './icons/Icons';

interface HeaderProps {
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-700">خوش آمدید, مدیر سیستم</h1>
      </div>
      <button 
        onClick={onLogout}
        className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
      >
        <LogoutIcon className="w-5 h-5 ml-2" />
        خروج
      </button>
    </header>
  );
};

export default Header;
