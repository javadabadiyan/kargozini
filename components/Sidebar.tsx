import React, { useState, useEffect } from 'react';
import { UserIcon, SettingsIcon, LockIcon, DashboardIcon, BriefcaseIcon, ChevronDownIcon, ShieldIcon } from './icons';
import { useSettings } from '../context/SettingsContext';


type Page = 'dashboard' | 'users' | 'settings' | 'user-management' | 
            'commitment_letter' | 'disciplinary_committee' | 'performance_evaluation' | 'job_group' | 'bonus_management' |
            'security_members' | 'security_log_traffic' | 'security_traffic_report';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOpen, onClose }) => {
  const { settings } = useSettings();
  
  const hrPages = ['commitment_letter', 'disciplinary_committee', 'performance_evaluation', 'job_group', 'bonus_management'];
  const securityPages = ['security_members', 'security_log_traffic', 'security_traffic_report'];

  const [isHrMenuOpen, setIsHrMenuOpen] = useState(hrPages.includes(activePage));
  const [isSecurityMenuOpen, setIsSecurityMenuOpen] = useState(securityPages.includes(activePage));

  useEffect(() => {
    setIsHrMenuOpen(hrPages.includes(activePage));
    setIsSecurityMenuOpen(securityPages.includes(activePage));
  }, [activePage]);

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: DashboardIcon },
    { id: 'users', label: 'مدیریت پرسنل', icon: UserIcon },
    { 
      id: 'hr_menu', 
      label: 'کارگزینی', 
      icon: BriefcaseIcon,
      children: [
        { id: 'commitment_letter', label: 'نامه تعهد حسابداری' },
        { id: 'disciplinary_committee', label: 'کمیته تشویق و انضباطی' },
        { id: 'performance_evaluation', label: 'ارزیابی عملکرد' },
        { id: 'job_group', label: 'گروه شغلی پرسنل' },
        { id: 'bonus_management', label: 'مدیریت کارانه' },
      ]
    },
    { 
      id: 'security_menu', 
      label: 'حراست', 
      icon: ShieldIcon,
      children: [
        { id: 'security_members', label: 'کارمندان عضو تردد' },
        { id: 'security_log_traffic', label: 'ثبت تردد' },
        { id: 'security_traffic_report', label: 'گزارش گیری تردد' },
      ]
    },
    { id: 'user-management', label: 'مدیریت کاربران', icon: LockIcon },
    { id: 'settings', label: 'تنظیمات', icon: SettingsIcon },
  ];

  // Helper to check if a parent menu is active
  const isParentActive = (item: any) => {
    return item.children && item.children.some((child: any) => child.id === activePage);
  };

  const handleNavigation = (page: Page) => {
    setActivePage(page);
    // Only close sidebar on mobile
    if (window.innerWidth < 768) {
        onClose();
    }
  }

  const handleMenuToggle = (menuId: string) => {
    if (menuId === 'hr_menu') setIsHrMenuOpen(!isHrMenuOpen);
    if (menuId === 'security_menu') setIsSecurityMenuOpen(!isSecurityMenuOpen);
  };

  const isMenuOpen = (menuId: string) => {
    if (menuId === 'hr_menu') return isHrMenuOpen;
    if (menuId === 'security_menu') return isSecurityMenuOpen;
    return false;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-60 z-30 transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Sidebar */}
      <div className={`w-64 h-screen bg-slate-900 text-slate-200 flex flex-col fixed top-0 right-0 z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center justify-center h-20 border-b border-slate-700 px-4">
          {settings?.app_logo && <img src={settings.app_logo} alt="Logo" className="w-10 h-10 rounded-full ml-3 object-cover" />}
          <h1 className="text-xl font-bold truncate text-white">{settings?.app_name || 'پنل کارگزینی'}</h1>
        </div>
        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.id}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => handleMenuToggle(item.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                        isParentActive(item)
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="w-6 h-6 ml-3" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDownIcon className={`w-5 h-5 transition-transform ${isMenuOpen(item.id) ? 'rotate-180' : ''}`} />
                    </button>
                    {isMenuOpen(item.id) && (
                      <ul className="pr-4 mt-2 space-y-2 animate-fade-in-down">
                        {item.children.map(child => (
                           <li key={child.id}>
                            <button
                              onClick={() => handleNavigation(child.id as Page)}
                              className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors duration-200 text-sm ${
                                activePage === child.id
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                              }`}
                            >
                              <span className="w-2 h-2 bg-slate-500 rounded-full ml-4"></span>
                              <span>{child.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleNavigation(item.id as Page)}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                      activePage === item.id
                        ? 'bg-blue-600 text-white font-semibold shadow-lg'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-6 h-6 ml-3" />
                    <span>{item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
};
