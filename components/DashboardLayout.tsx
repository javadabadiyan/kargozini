
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import Header from './Header';
import PersonnelListPage from './pages/PersonnelListPage';

interface DashboardLayoutProps {
  onLogout: () => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ onLogout }) => {
  // صفحه پیش‌فرض اکنون لیست پرسنل است
  const [ActivePage, setActivePage] = useState<React.ComponentType>(() => PersonnelListPage);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 relative lg:overflow-hidden">
      <Sidebar setActivePage={setActivePage} isOpen={isSidebarOpen} onClose={closeSidebar} />
      {/* Overlay for mobile to close sidebar on click outside */}
      {isSidebarOpen && (
         <div 
           className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
           onClick={closeSidebar}
           aria-hidden="true"
         ></div>
      )}
      <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <Header onLogout={onLogout} onMenuClick={toggleSidebar} />
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