import React, { useState, useEffect, useCallback } from 'react';
import type { MenuItem } from '../types';
// Fix: Removed `UserGroupIcon` as it's not exported from Icons.tsx.
import { ChevronDownIcon, ChevronUpIcon, CircleIcon, HomeIcon, DocumentTextIcon, BriefcaseIcon, ShieldCheckIcon, LockClosedIcon, UsersIcon } from './icons/Icons';
import DependentsInfoPage from './pages/DependentsInfoPage';
import PlaceholderPage from './pages/PlaceholderPage';
import PersonnelListPage from './pages/PersonnelListPage';

// Define placeholder pages as stable, named components to prevent re-creation on every render.
const DashboardPage = () => <PlaceholderPage title="داشبورد" />;
const DocumentUploadPage = () => <PlaceholderPage title="بارگذاری مدارک" />;
const AccountingCommitmentPage = () => <PlaceholderPage title="نامه تعهد حسابداری" />;
const DisciplinaryCommitteePage = () => <PlaceholderPage title="کمیته تشویق و انضباطی" />;
const PerformanceReviewPage = () => <PlaceholderPage title="ارزیابی عملکرد" />;
const JobGroupPage = () => <PlaceholderPage title="گروه شغلی پرسنل" />;
const BonusManagementPage = () => <PlaceholderPage title="مدیریت کارانه" />;
const CommutingMembersPage = () => <PlaceholderPage title="کارمندان عضو تردد" />;
const LogCommutePage = () => <PlaceholderPage title="ثبت تردد" />;
const CommuteReportPage = () => <PlaceholderPage title="گزارش گیری تردد" />;
const UserManagementPage = () => <PlaceholderPage title="مدیریت کاربران" />;

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: HomeIcon, page: DashboardPage },
  { 
    id: 'personnel', label: 'مدیریت پرسنل', icon: UsersIcon,
    children: [
      { id: 'personnel-list', label: 'لیست پرسنل', icon: CircleIcon, page: PersonnelListPage },
      { id: 'dependents-info', label: 'اطلاعات بستگان', icon: CircleIcon, page: DependentsInfoPage },
      { id: 'document-upload', label: 'بارگذاری مدارک', icon: DocumentTextIcon, page: DocumentUploadPage }
    ]
  },
  { 
    id: 'recruitment', label: 'کارگزینی', icon: BriefcaseIcon,
    children: [
      { id: 'accounting-commitment', label: 'نامه تعهد حسابداری', icon: CircleIcon, page: AccountingCommitmentPage },
      { id: 'disciplinary-committee', label: 'کمیته تشویق و انضباطی', icon: CircleIcon, page: DisciplinaryCommitteePage },
      { id: 'performance-review', label: 'ارزیابی عملکرد', icon: CircleIcon, page: PerformanceReviewPage },
      { id: 'job-group', label: 'گروه شغلی پرسنل', icon: CircleIcon, page: JobGroupPage },
      { id: 'bonus-management', label: 'مدیریت کارانه', icon: CircleIcon, page: BonusManagementPage }
    ]
  },
  {
    id: 'security', label: 'حراست', icon: ShieldCheckIcon,
    children: [
      { id: 'commuting-members', label: 'کارمندان عضو تردد', icon: CircleIcon, page: CommutingMembersPage },
      { id: 'log-commute', label: 'ثبت تردد', icon: CircleIcon, page: LogCommutePage },
      { id: 'commute-report', label: 'گزارش گیری تردد', icon: CircleIcon, page: CommuteReportPage }
    ]
  },
  { id: 'user-management', label: 'مدیریت کاربران', icon: LockClosedIcon, page: UserManagementPage }
];


const SidebarMenuItem: React.FC<{
  item: MenuItem;
  activeItem: string;
  setActiveItem: (id: string, page: React.ComponentType) => void;
  openItems: Record<string, boolean>;
  toggleItem: (id: string) => void;
}> = ({ item, activeItem, setActiveItem, openItems, toggleItem }) => {
  const isParent = !!item.children;
  const isActive = activeItem === item.id || item.children?.some(child => child.id === activeItem);
  const isOpen = openItems[item.id] ?? false;

  const handleClick = () => {
    if (isParent) {
      toggleItem(item.id);
    } else if (item.page) {
      setActiveItem(item.id, item.page);
    }
  };
  
  const handleChildClick = (child: MenuItem) => {
     if(child.page) {
       setActiveItem(child.id, child.page);
     }
  }

  const baseClasses = 'w-full flex items-center p-3 my-1 rounded-lg transition-colors duration-200 cursor-pointer';
  const activeClasses = 'bg-blue-600 text-white shadow-lg';
  const inactiveClasses = 'text-gray-300 hover:bg-slate-700 hover:text-white';

  if (isParent) {
    return (
      <div>
        <div
          onClick={handleClick}
          className={`${baseClasses} ${isActive ? 'text-white' : inactiveClasses}`}
        >
          <item.icon className="w-6 h-6 ms-2"/>
          <span className="flex-1 text-right mr-3">{item.label}</span>
          {isOpen ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
        </div>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="mr-6 border-r-2 border-slate-600 pr-4">
          {item.children?.map(child => (
            <div key={child.id} onClick={() => handleChildClick(child)} 
              className={`flex items-center p-2 my-1 rounded-lg transition-colors duration-200 cursor-pointer text-sm ${activeItem === child.id ? 'text-blue-400 font-semibold' : 'text-gray-400 hover:text-white'}`}>
              <child.icon className={`w-5 h-5 ms-2 ${activeItem === child.id ? 'text-blue-400' : ''}`} />
              <span className="mr-2">{child.label}</span>
            </div>
          ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`${baseClasses} ${activeItem === item.id ? activeClasses : inactiveClasses}`}
    >
      <item.icon className="w-6 h-6 ms-2"/>
      <span className="flex-1 text-right mr-3">{item.label}</span>
    </div>
  );
};


const Sidebar: React.FC<{ setActivePage: React.Dispatch<React.SetStateAction<React.ComponentType>> }> = ({ setActivePage }) => {
  const [activeItem, setActiveItem] = useState<string>('personnel-list');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
      personnel: true,
      recruitment: false,
      security: false
  });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const handleSetActiveItem = useCallback((id: string, page: React.ComponentType) => {
    setActiveItem(id);
    setActivePage(() => page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActivePage]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({...prev, [id]: !prev[id]}));
  };

  const toPersianDigits = (s: string) => s.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);

  const rawFormattedTime = time.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formattedTime = toPersianDigits(rawFormattedTime);

  const rawFormattedDate = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(time).replace('،', '');
  const formattedDate = toPersianDigits(rawFormattedDate);


  return (
    <aside className="w-72 bg-slate-800 text-white flex flex-col shadow-2xl">
      <div className="p-6 border-b border-slate-700 text-center">
        <h2 className="text-xl font-bold">سیستم جامع کارگزینی</h2>
      </div>
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        {menuItems.map(item => (
          <SidebarMenuItem 
            key={item.id}
            item={item}
            activeItem={activeItem}
            setActiveItem={handleSetActiveItem}
            openItems={openItems}
            toggleItem={toggleItem}
          />
        ))}
      </nav>
      <div className="p-6 border-t border-slate-700 text-center">
        <p className="text-3xl font-mono tracking-widest">{formattedTime}</p>
        <p className="text-sm text-gray-400 mt-1">{formattedDate}</p>
      </div>
    </aside>
  );
};

export default Sidebar;