import React from 'react';
import { LogoutIcon, MenuIcon } from './icons/Icons';

interface HeaderProps {
  onLogout: () => void;
  onMenuClick: () => void;
  username: string;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onMenuClick, username }) => {
  return (
    <header className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg shadow-sm p-4 flex justify-between items-center sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-center">
        <button 
          onClick={onMenuClick} 
          className="lg:hidden text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white mr-4"
          aria-label="باز کردن منو"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-200 hidden sm:block">خوش آمدید, {username}</h1>
      </div>
      <button 
        onClick={onLogout}
        className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
      >
        <LogoutIcon className="w-5 h-5 ml-2" />
        خروج
      </button>
    </header>
  );
};

export default Header;
