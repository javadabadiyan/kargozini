import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import type { MenuItem, UserPermissions } from '../types';
import { ChevronDownIcon, ChevronUpIcon, XIcon } from './icons/Icons';
import { ALL_MENU_ITEMS } from './menuConfig';

const SidebarMenuItem: React.FC<{
  item: MenuItem;
  activeItem: string;
  setActiveItem: (id: string, page: React.ComponentType) => void;
  openItems: Record<string, boolean>;
  toggleItem: (id: string) => void;
  permissions: UserPermissions;
}> = ({ item, activeItem, setActiveItem, openItems, toggleItem, permissions }) => {
  const isParent = !!item.children;

  const hasActiveChild = (menuItems: MenuItem[] | undefined): boolean => {
    if (!menuItems) return false;
    return menuItems.some(child => 
      child.id === activeItem || hasActiveChild(child.children)
    );
  };
  const isActive = activeItem === item.id || hasActiveChild(item.children);

  const isOpen = openItems[item.id] ?? false;

  const handleClick = () => {
    if (isParent) {
      toggleItem(item.id);
    } else if (item.page) {
      setActiveItem(item.id, item.page);
    }
  };

  const baseClasses = 'w-full flex items-center p-3 my-1 rounded-lg transition-all duration-200 cursor-pointer';
  const activeClasses = 'bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-lg';
  const inactiveClasses = 'text-slate-300 hover:bg-slate-700 hover:text-white';

  if (isParent) {
    return (
      <div>
        <div
          onClick={handleClick}
          className={`${baseClasses} ${isActive ? 'text-white font-semibold' : inactiveClasses}`}
        >
          <item.icon className="w-6 h-6 ms-2"/>
          <span className="flex-1 text-right mr-3">{item.label}</span>
          {isOpen ? <ChevronUpIcon className="w-5 h-5"/> : <ChevronDownIcon className="w-5 h-5"/>}
        </div>
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="mr-6 border-r-2 border-slate-700 pr-4">
            {item.children?.filter(child => permissions[child.id] || (child.children && child.children.some(c => permissions[c.id]))).map(child => {
              if (child.children) { // Nested parent item
                const isChildOpen = openItems[child.id] ?? false;
                const isChildActive = hasActiveChild([child]);
                 return (
                 <div key={child.id}>
                    <div onClick={() => toggleItem(child.id)} className={`flex items-center justify-between p-2 my-1 rounded-lg transition-colors duration-200 cursor-pointer text-sm ${isChildActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-white'}`}>
                        <div className="flex items-center">
                          <child.icon className={`w-5 h-5 ms-2 ${isChildActive ? 'text-sky-400' : ''}`} />
                          <span className="mr-2">{child.label}</span>
                        </div>
                        {isChildOpen ? <ChevronUpIcon className="w-4 h-4"/> : <ChevronDownIcon className="w-4 h-4"/>}
                    </div>
                     <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isChildOpen ? 'max-h-96' : 'max-h-0'}`}>
                        <div className="mr-4 border-r-2 border-slate-700/50 pr-2">
                            {child.children?.filter(grandchild => permissions[grandchild.id]).map(grandchild => (
                                <div key={grandchild.id} onClick={() => grandchild.page && setActiveItem(grandchild.id, grandchild.page)} className={`flex items-center p-2 my-1 rounded-lg transition-colors duration-200 cursor-pointer text-xs ${activeItem === grandchild.id ? 'text-sky-400 font-bold' : 'text-slate-400 hover:text-white'}`}>
                                    <grandchild.icon className={`w-4 h-4 ms-2 ${activeItem === grandchild.id ? 'text-sky-400' : ''}`} />
                                    <span className="mr-2">{grandchild.label}</span>
                                </div>
                            ))}
                        </div>
                     </div>
                 </div>
                );
              }
              // Leaf child item
              return (
                <div key={child.id} onClick={() => child.page && setActiveItem(child.id, child.page)} 
                  className={`flex items-center p-2 my-1 rounded-lg transition-colors duration-200 cursor-pointer text-sm ${activeItem === child.id ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-white'}`}>
                  <child.icon className={`w-5 h-5 ms-2 ${activeItem === child.id ? 'text-sky-400' : ''}`} />
                  <span className="mr-2">{child.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Top-level leaf node logic
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

    const toPersianDigits = (s: string) => s.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);

    const timeFormatter = useMemo(() => new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Tehran'
    }), []);

    const dateFormatter = useMemo(() => new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
        timeZone: 'Asia/Tehran'
    }), []);

    useEffect(() => {
        const timerId = setInterval(() => {
            previousTimeRef.current = timeFormatter.format(new Date());
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timerId);
    }, [timeFormatter]);

    const rawFormattedTime = timeFormatter.format(time);
    const formattedTime = toPersianDigits(rawFormattedTime);
    const previousFormattedTime = toPersianDigits(previousTimeRef.current);
    
    const parts = dateFormatter.formatToParts(time);
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';
    const rawFormattedDate = `${weekday} ${day} ${month} ${year}`;
    const formattedDate = toPersianDigits(rawFormattedDate);

    return (
        <div className="p-6 border-t border-slate-700 text-center text-white">
            <div className="text-4xl font-bold tracking-wider" dir="ltr">
                {formattedTime.split('').map((char, index) => {
                    const hasChanged = formattedTime[index] !== previousFormattedTime[index];
                    return char === ':' ?
                        <span key={index} className="px-1 opacity-50">:</span> :
                        <AnimatedDigit key={`${index}-${char}`} digit={char} hasChanged={hasChanged} />;
                })}
            </div>
            <p className="text-sm text-slate-400 mt-2">{formattedDate}</p>
        </div>
    );
};


export const Sidebar: React.FC<{ 
  setActivePage: (id: string, page: React.ComponentType) => void;
  activePageId: string;
  isOpen: boolean;
  onClose: () => void;
  user: { permissions: UserPermissions };
}> = ({ setActivePage, activePageId, isOpen, onClose, user }) => {
  const { permissions } = user;
  const menuItems = useMemo(() => {
    const hasVisibleChild = (item: MenuItem, userPermissions: UserPermissions): boolean => {
        if (!item.children) return false;
        return item.children.some(child => {
            if (userPermissions[child.id]) return true;
            return hasVisibleChild(child, userPermissions);
        });
    };

    return ALL_MENU_ITEMS.filter(item => 
      permissions[item.id] || hasVisibleChild(item, permissions)
    );
  }, [permissions]);

  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
      personnel: true,
      recruitment: false,
      security: true
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
    setActivePage(id, page);
    onClose(); // Close sidebar on mobile after selection
  }, [setActivePage, onClose]);

  const toggleItem = (id: string) => {
    setOpenItems(prev => ({...prev, [id]: !prev[id]}));
  };

  return (
    <aside className={`w-72 bg-slate-900 text-white flex flex-col shadow-2xl fixed lg:static inset-y-0 right-0 z-30 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0`}>
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
            activeItem={activePageId}
            setActiveItem={handleSetActiveItem}
            openItems={openItems}
            toggleItem={toggleItem}
            permissions={permissions}
          />
        ))}
      </nav>
      <Clock />
    </aside>
  );
};
