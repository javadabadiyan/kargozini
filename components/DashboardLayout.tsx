
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import PersonnelListPage from './pages/PersonnelListPage';

interface DashboardLayoutProps {
  onLogout: () => void;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ onLogout }) => {
  // صفحه پیش‌فرض اکنون لیست پرسنل است
  const [ActivePage, setActivePage] = useState<React.ComponentType>(() => PersonnelListPage);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* سایدبار برای طرح‌بندی راست‌چین در ابتدا قرار می‌گیرد */}
      <Sidebar setActivePage={setActivePage} />
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <Header onLogout={onLogout} />
        <div className="p-6">
            <ActivePage />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;