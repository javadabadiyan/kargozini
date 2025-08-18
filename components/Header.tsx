
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogoutIcon } from './icons';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          خوش آمدید, {user?.firstName} {user?.lastName}
        </h2>
      </div>
      <button 
        onClick={logout}
        className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-100 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
      >
        <LogoutIcon className="w-5 h-5 ml-2"/>
        خروج
      </button>
    </header>
  );
};
