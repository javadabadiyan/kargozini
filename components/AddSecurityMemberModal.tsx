import React, { useState, useMemo } from 'react';
import type { Personnel } from '../types';
import { CloseIcon } from './icons';
import { toPersianDigits } from './format';

interface AddSecurityMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (personnelId: number) => void;
  personnelList: Personnel[];
  existingMemberIds: number[];
}

export const AddSecurityMemberModal: React.FC<AddSecurityMemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  personnelList,
  existingMemberIds,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<number | null>(null);

  const availablePersonnel = useMemo(() => {
    const existingIdsSet = new Set(existingMemberIds);
    return personnelList.filter(p => !existingIdsSet.has(p.id));
  }, [personnelList, existingMemberIds]);

  const filteredPersonnel = useMemo(() => {
    if (!searchTerm) {
      return availablePersonnel;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return availablePersonnel.filter(p =>
      p.first_name.toLowerCase().includes(lowercasedFilter) ||
      p.last_name.toLowerCase().includes(lowercasedFilter) ||
      p.personnel_code.includes(lowercasedFilter)
    );
  }, [searchTerm, availablePersonnel]);

  const handleSubmit = () => {
    if (selectedPersonnelId) {
      onSave(selectedPersonnelId);
      setSearchTerm('');
      setSelectedPersonnelId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 pt-10 sm:pt-20">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative animate-fade-in-down flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-slate-800 p-2 rounded-full hover:bg-slate-100 transition">
          <CloseIcon />
        </button>
        <h2 className="text-2xl font-bold mb-4 text-slate-800">افزودن عضو جدید به لیست تردد</h2>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="جستجوی نام یا کد پرسنلی..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        
        <div className="flex-grow overflow-y-auto border rounded-lg p-2 bg-slate-50">
          {filteredPersonnel.length > 0 ? (
            <ul className="space-y-1">
              {filteredPersonnel.map(p => (
                <li
                  key={p.id}
                  onClick={() => setSelectedPersonnelId(p.id)}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${selectedPersonnelId === p.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-200'}`}
                >
                  <div className="font-semibold">{p.first_name} {p.last_name}</div>
                  <div className="text-sm">{`کد پرسنلی: ${toPersianDigits(p.personnel_code)}`}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-slate-500 py-8">
              {availablePersonnel.length === 0 ? "تمام پرسنل به لیست اضافه شده‌اند." : "هیچ پرسنلی با این مشخصات یافت نشد."}
            </p>
          )}
        </div>
        
        <div className="flex justify-end pt-6 border-t border-slate-200 space-x-2 space-x-reverse mt-4">
          <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition font-medium">انصراف</button>
          <button type="button" onClick={handleSubmit} disabled={!selectedPersonnelId} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed">
            افزودن
          </button>
        </div>
      </div>
    </div>
  );
};
