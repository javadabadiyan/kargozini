
import React from 'react';
import { UserIcon } from './icons';

export const Sidebar: React.FC = () => {
  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col fixed top-0 right-0">
      <div className="flex items-center justify-center h-20 border-b border-gray-700">
        <h1 className="text-2xl font-bold">پنل کارگزینی</h1>
      </div>
      <nav className="flex-1 px-4 py-6">
        <ul>
          <li>
            <a href="#" className="flex items-center px-4 py-3 text-gray-300 bg-gray-700 rounded-lg">
              <UserIcon className="w-6 h-6 ml-3" />
              <span>مدیریت کاربران</span>
            </a>
          </li>
          {/* Add more navigation items here if needed */}
        </ul>
      </nav>
    </div>
  );
};
