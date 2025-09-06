import React, { useState, useMemo, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import Header from './Header';
import type { UserPermissions, MenuItem } from '../types';
import { ALL_MENU_ITEMS } from './menuConfig';

interface CurrentUser {
  username: string;
  permissions: UserPermissions;
}

interface DashboardLayoutProps {
  onLogout: () => void;
  user: CurrentUser;
}

const findFirstPage = (permissions: UserPermissions): { page: React.ComponentType; id: string } | null => {
    for (const item of ALL_MENU_ITEMS) {
        if (item.page && permissions[item.id]) {
            return { page: item.page, id: item.id };
        }
        if (item.children) {
            for (const child of item.children) {
                if (child.page && permissions[child.id]) {
                    return { page: child.page, id: child.id };
                }
            }
        }
    }
    return null;
};

const NoAccessPage: React.FC = () => (
    <div className="bg-white p-6 rounded-lg shadow-lg flex items-center justify-center h-full">
      <div className="text-center text-gray-500">
        <h2 className="text-2xl font-bold mb-4">عدم دسترسی</h2>
        <p>شما به هیچ صفحه‌ای دسترسی ندارید. لطفاً با مدیر سیستم تماس بگیرید.</p>
      </div>
    </div>
);

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ onLogout, user }) => {
  const initialPageInfo = useMemo(() => {
    const first = findFirstPage(user.permissions);
    if (first) return first;
    return { page: NoAccessPage, id: 'no-access' };
  }, [user.permissions]);

  const [ActivePage, setActivePage] = useState<React.ComponentType>(() => initialPageInfo.page);
  const [activePageId, setActivePageId] = useState<string>(initialPageInfo.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSetPage = useCallback((id: string, page: React.ComponentType) => {
    setActivePageId(id);
    setActivePage(() => page);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar 
        setActivePage={handleSetPage} 
        activePageId={activePageId} 
        isOpen={isSidebarOpen} 
        onClose={closeSidebar} 
        user={user} 
      />
      {/* Overlay for mobile to close sidebar on click outside */}
      {isSidebarOpen && (
         <div 
           className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
           onClick={closeSidebar}
           aria-hidden="true"
         ></div>
      )}
      <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <Header onLogout={onLogout} onMenuClick={toggleSidebar} username={user.username} />
        <div className="p-4 sm:p-6 flex-1">
            <ActivePage />
        </div>
        <footer className="text-center py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">طراح و کدنویسی جواد آبادیان</p>
        </footer>
      </main>
    </div>
  );
};

export default DashboardLayout;