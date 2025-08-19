import React, { useState, useRef, useEffect } from 'react';
import type { Personnel } from '../types';
import { toPersianDigits } from './format';

interface AccountingCommitmentPageProps {
  personnelList: Personnel[];
}

export const AccountingCommitmentPage: React.FC<AccountingCommitmentPageProps> = ({ personnelList }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('fa-IR'));
  
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const printableContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePersonnelSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonnelSearch(e.target.value);
    setSelectedPersonnel(null);
    if (!isDropdownOpen) {
        setIsDropdownOpen(true);
    }
  };

  const handleSelectPersonnel = (p: Personnel) => {
    setSelectedPersonnel(p);
    setPersonnelSearch(`${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})`);
    setIsDropdownOpen(false);
  };
  
  const filteredPersonnel = personnelList.filter(p => {
    if (!personnelSearch || (selectedPersonnel && personnelSearch === `${selectedPersonnel.first_name} ${selectedPersonnel.last_name} (${toPersianDigits(selectedPersonnel.personnel_code)})`)) {
      return false; // Don't show list if search is empty or a user is already selected
    }
    const searchTerm = personnelSearch.toLowerCase();
    return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm) ||
        p.personnel_code.toLowerCase().includes(searchTerm)
    );
  });

  const handleSave = () => {
    if (!title || !body || !selectedPersonnel || !date) {
        alert('لطفاً تمام فیلدها را پر کنید.');
        return;
    }
    const commitmentData = {
        title,
        body,
        personnel: `${selectedPersonnel.first_name} ${selectedPersonnel.last_name}`,
        date,
    };
    // In a real app, this would be an API call. For now, we'll log it and alert.
    console.log("Saving data:", commitmentData);
    localStorage.setItem('commitmentLetter', JSON.stringify(commitmentData));
    alert('نامه تعهد با موفقیت ذخیره شد.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-bold text-slate-700 mb-6">نامه تعهد حسابداری</h1>
      <div className="bg-white rounded-xl shadow-md p-8 border border-slate-200">
        <div ref={printableContentRef} className="printable-area">
            <h2 className="text-2xl font-bold text-center mb-8 print:text-black">{title || 'عنوان نامه'}</h2>
            <div className="space-y-6">
                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
                   <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">عنوان نامه</label>
                        <input
                            type="text"
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="مثال: تعهدنامه کسر از حقوق"
                        />
                    </div>
                     <div className="relative" ref={dropdownRef}>
                        <label htmlFor="personnel_search" className="block text-sm font-medium text-slate-700 mb-1">نام و نام خانوادگی</label>
                        <input
                            id="personnel_search"
                            type="text"
                            value={personnelSearch}
                            onChange={handlePersonnelSearchChange}
                            onFocus={() => setIsDropdownOpen(true)}
                            placeholder="جستجوی پرسنل..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoComplete="off"
                        />
                        {isDropdownOpen && filteredPersonnel.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {filteredPersonnel.map(p => (
                                    <li
                                        key={p.id}
                                        onClick={() => handleSelectPersonnel(p)}
                                        className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                        {p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                
                <div className="no-print">
                    <label htmlFor="body" className="block text-sm font-medium text-slate-700 mb-1">متن نامه</label>
                    <textarea
                        id="body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="متن تعهدنامه را در اینجا وارد کنید..."
                    />
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 no-print">
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">تاریخ</label>
                        <input
                            type="text"
                            id="date"
                            value={toPersianDigits(date)}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Printable Content */}
                <div className="hidden print:block leading-loose text-lg text-justify pt-8 space-y-8">
                    <p>{body}</p>
                    <div className="pt-16 flex justify-between items-center">
                        <div>
                            <p className="font-semibold">نام و نام خانوادگی:</p>
                            <p>{selectedPersonnel ? `${selectedPersonnel.first_name} ${selectedPersonnel.last_name}` : '____________________'}</p>
                        </div>
                         <div>
                            <p className="font-semibold">امضاء</p>
                        </div>
                        <div>
                            <p className="font-semibold">تاریخ:</p>
                            <p>{toPersianDigits(date)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-8 mt-8 border-t border-slate-200 space-x-2 space-x-reverse no-print">
          <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">ذخیره</button>
          <button onClick={handlePrint} className="px-5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium shadow-sm">چاپ</button>
        </div>
      </div>
    </div>
  );
};