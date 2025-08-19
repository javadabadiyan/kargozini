import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogoutIcon, MenuIcon } from './icons';

interface HeaderProps {
    onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-slate-50/80 backdrop-blur-lg border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20">
      <div className="flex items-center">
         <button onClick={onMenuToggle} className="text-slate-500 focus:outline-none md:hidden ml-4 p-2 rounded-full hover:bg-slate-200">
          <MenuIcon className="w-6 h-6" />
        </button>
        <h2 className="text-lg md:text-xl font-semibold text-slate-800">
          خوش آمدید, {user?.firstName} {user?.lastName}
        </h2>
      </div>
      <button 
        onClick={logout}
        className="flex items-center px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition"
      >
        <LogoutIcon className="w-5 h-5 ml-2 text-red-500"/>
        خروج
      </button>
    </header>
  );
};