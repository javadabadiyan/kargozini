
import React, { useState, useMemo, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import Header from './Header';
// FIX: Changed import from `import type` to `import` to correctly load types from the module.
import { UserPermissions, MenuItem } from '../types';
import { ALL_MENU_ITEMS } from './menuConfig';

interface CurrentUser {
  username: string;
  permissions: UserPermissions;
  full_name?: string;
}

interface DashboardLayoutProps {
  onLogout: () => void;
  user: CurrentUser;
}

const AnimatedBackground: React.FC = () => (
  <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 rounded-full filter blur-3xl opacity-40 bg-shape" />
    <div className="absolute top-60 -right-40 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full filter blur-3xl opacity-30 bg-shape2" />
    <div className="absolute bottom-[-10rem] left-10 w-80 h-80 bg-blue-500/10 rounded-full filter blur-3xl opacity-50 bg-shape3" />
  </div>
);

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
    <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg p-6 rounded-xl shadow-xl flex items-center justify-center h-full">
      <div className="text-center text-slate-600 dark:text-slate-400">
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
    <div className="flex h-screen bg-transparent">
      <AnimatedBackground />
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
        <Header onLogout={onLogout} onMenuClick={toggleSidebar} userFullName={user.full_name || user.username} />
        <div className="p-4 sm:p-6 flex-1">
            <ActivePage />
        </div>
        <footer className="text-center py-4 bg-transparent border-t border-slate-200/50 dark:border-slate-800/50">
            <p className="text-sm text-slate-500 dark:text-slate-400">طراح و کدنویسی جواد آبادیان</p>
        </footer>
      </main>
    </div>
  );
};

export default DashboardLayout;