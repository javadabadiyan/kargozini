
import React from 'react';
import { LogoutIcon, MenuIcon } from './icons/Icons';

interface HeaderProps {
  onLogout: () => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onMenuClick }) => {
  return (
    <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick} 
          className="lg:hidden text-gray-600 hover:text-gray-800 mr-4"
          aria-label="باز کردن منو"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-700 hidden sm:block">خوش آمدید, مدیر سیستم</h1>
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
