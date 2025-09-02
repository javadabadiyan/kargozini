import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import type { MenuItem, UserPermissions } from '../types';
import { ChevronDownIcon, ChevronUpIcon, CircleIcon, HomeIcon, DocumentTextIcon, BriefcaseIcon, ShieldCheckIcon, UsersIcon, XIcon, DocumentReportIcon, CogIcon } from './icons/Icons';
import DependentsInfoPage from './pages/DependentsInfoPage';
import PlaceholderPage from './pages/PlaceholderPage';
import PersonnelListPage from './pages/PersonnelListPage';
import CommutingMembersPage from './pages/CommutingMembersPage';
import LogCommutePage from './pages/LogCommutePage';
import CommuteReportPage from './pages/CommuteReportPage';
import SettingsPage from './pages/SettingsPage';

const DashboardPage = () => <PlaceholderPage title="داشبورد" />;
const DocumentUploadPage = () => <PlaceholderPage title="بارگذاری مدارک" />;
const AccountingCommitmentPage = () => <PlaceholderPage title="نامه تعهد حسابداری" />;
const DisciplinaryCommitteePage = () => <PlaceholderPage title="کمیته تشویق و انضباطی" />;
const PerformanceReviewPage = () => <PlaceholderPage title="ارزیابی عملکرد" />;
const JobGroupPage = () => <PlaceholderPage title="گروه شغلی پرسنل" />;
const BonusManagementPage = () => <PlaceholderPage title="مدیریت کارانه" />;

const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: HomeIcon, page: DashboardPage },
  { 
    id: 'personnel_parent', label: 'مدیریت پرسنل', icon: UsersIcon,
    children: [
      { id: 'personnel_list', label: 'لیست پرسنل', icon: CircleIcon, page: PersonnelListPage },
      { id: 'dependents_info', label: 'اطلاعات بستگان', icon: CircleIcon, page: DependentsInfoPage },
      { id: 'document_upload', label: 'بارگذاری مدارک', icon: DocumentTextIcon, page: DocumentUploadPage }
    ]
  },
  { 
    id: 'recruitment_parent', label: 'کارگزینی', icon: BriefcaseIcon,
    children: [
      { id: 'accounting_commitment', label: 'نامه تعهد حسابداری', icon: CircleIcon, page: AccountingCommitmentPage },
      { id: 'disciplinary_committee', label: 'کمیته تشویق و انضباطی', icon: CircleIcon, page: DisciplinaryCommitteePage },
      { id: 'performance_review', label: 'ارزیابی عملکرد', icon: CircleIcon, page: PerformanceReviewPage },
      { id: 'job_group', label: 'گروه شغلی پرسنل', icon: CircleIcon, page: JobGroupPage },
      { id: 'bonus_management', label: 'مدیریت کارانه', icon: CircleIcon, page: BonusManagementPage }
    ]
  },
  {
    id: 'security_parent', label: 'حراست', icon: ShieldCheckIcon,
    children: [
      { id: 'commuting_members', label: 'کارمندان عضو تردد', icon: CircleIcon, page: CommutingMembersPage },
      { id: 'log_commute', label: 'ثبت تردد', icon: CircleIcon, page: LogCommutePage },
      { id: 'commute_report', label: 'گزارش گیری تردد', icon: DocumentReportIcon, page: CommuteReportPage }
    ]
  },
  { id: 'settings', label: 'تنظیمات', icon: CogIcon, page: SettingsPage }
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

const AnimatedDigit: React.FC<{ digit: string; hasChanged: boolean }> = memo(({ digit, hasChanged }) => {
  return (
    <span className={`inline-block ${hasChanged ? 'digit-animate' : ''}`}>
      {digit}
    </span>
  );
});

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  const previousTimeRef = useRef('');

  useEffect(() => {
    const timerId = setInterval(() => {
      previousTimeRef.current = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  const toPersianDigits = (s: string) => s.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);

  const rawFormattedTime = time.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formattedTime = toPersianDigits(rawFormattedTime);
  const previousFormattedTime = toPersianDigits(previousTimeRef.current);
  
  const rawFormattedDate = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(time).replace('،', '');
  const formattedDate = toPersianDigits(rawFormattedDate);

  return (
    <div className="p-6 border-t border-slate-700 text-center">
      <div className="text-4xl font-bold tracking-wider" dir="ltr">
        {formattedTime.split('').map((char, index) => {
            const hasChanged = formattedTime[index] !== previousFormattedTime[index];
            return char === ':' ? 
                <span key={index} className="px-1">:</span> : 
                <AnimatedDigit key={`${index}-${char}`} digit={char} hasChanged={hasChanged} />;
        })}
      </div>
      <p className="text-sm text-gray-400 mt-2">{formattedDate}</p>
    </div>
  );
};


export const Sidebar: React.FC<{ 
  setActivePage: React.Dispatch<React.SetStateAction<React.ComponentType>>;
  isOpen: boolean;
  onClose: () => void;
  user: { permissions: UserPermissions };
}> = ({ setActivePage, isOpen, onClose, user }) => {
  const { permissions } = user;
  const menuItems = useMemo(() => {
    const filterItems = (items: MenuItem[]): MenuItem[] => {
        return items.reduce<MenuItem[]>((acc, item) => {
            if (item.children) {
                const visibleChildren = filterItems(item.children);
                if (visibleChildren.length > 0) {
                    acc.push({ ...item, children: visibleChildren });
                }
            } else if (permissions[item.id]) {
                acc.push(item);
            }
            return acc;
        }, []);
    };
    return filterItems(ALL_MENU_ITEMS);
  }, [permissions]);

  const [activeItem, setActiveItem] = useState<string>('personnel_list');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
      personnel_parent: true,
      recruitment_parent: false,
      security_parent: true
  });

  const [appName, setAppName] = useState('سیستم جامع کارگزینی');
  const [appLogo, setAppLogo] = useState<string | null>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('appName');
    const savedLogo = localStorage.getItem('appLogo');
    if (savedName) setAppName(savedName);
    if (savedLogo) setAppLogo(savedLogo);
  }, []);
  
  const handleSetActiveItem = useCallback((id: string, page: React.ComponentType) => {
    setActiveItem(id);
    setActivePage(() => page);
    onClose(); // Close sidebar on mobile after selection
  }, [setActivePage, onClose]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <aside className={`w-72 bg-slate-800 text-white flex flex-col shadow-2xl fixed lg:static inset-y-0 right-0 z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0`}>
      <div className="flex items-center justify-between p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {appLogo && <img src={appLogo} alt="لوگو" className="w-9 h-9 rounded-md object-cover" />}
          <h2 className="text-xl font-bold">{appName}</h2>
        </div>
         <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white" aria-label="بستن منو">
            <XIcon className="w-6 h-6" />
        </button>
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
      <Clock />
    </aside>
  );
};