import React, { useState, useEffect, useRef } from 'react';
import type { Personnel, Relative } from '../types';
import { CloseIcon } from './icons';
import { toPersianDigits } from './format';

interface AddRelativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (relative: Omit<Relative, 'id'> | Relative) => void;
  relativeToEdit?: Relative | null;
  personnelList: Personnel[];
}

export const AddRelativeModal: React.FC<AddRelativeModalProps> = ({ isOpen, onClose, onSave, relativeToEdit, personnelList }) => {
  const initialFormState = {
    personnel_id: '',
    first_name: '',
    last_name: '',
    relation: '',
    national_id: '',
    birth_date: '',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (relativeToEdit) {
        setFormData({
            ...relativeToEdit,
            personnel_id: String(relativeToEdit.personnel_id)
        });
        const selectedPersonnel = personnelList.find(p => p.id === relativeToEdit.personnel_id);
        if (selectedPersonnel) {
            setPersonnelSearch(`${selectedPersonnel.first_name} ${selectedPersonnel.last_name} (${toPersianDigits(selectedPersonnel.personnel_code)})`);
        } else {
            setPersonnelSearch('');
        }
      } else {
        setFormData(initialFormState);
        setPersonnelSearch('');
      }
      setIsDropdownOpen(false);
    }
  }, [relativeToEdit, isOpen, personnelList]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePersonnelSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPersonnelSearch(e.target.value);
    if (formData.personnel_id) {
        setFormData(prev => ({ ...prev, personnel_id: '' }));
    }
    if (!isDropdownOpen) {
        setIsDropdownOpen(true);
    }
  };

  const handleSelectPersonnel = (p: Personnel) => {
    setFormData(prev => ({ ...prev, personnel_id: String(p.id) }));
    setPersonnelSearch(`${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})`);
    setIsDropdownOpen(false);
  };
  
  const filteredPersonnel = personnelList.filter(p => {
    if (!personnelSearch) return true;

    const selectedPerson = formData.personnel_id ? personnelList.find(sp => String(sp.id) === formData.personnel_id) : null;
    const isSearchUnchanged = selectedPerson && personnelSearch === `${selectedPerson.first_name} ${selectedPerson.last_name} (${toPersianDigits(selectedPerson.personnel_code)})`;

    if (isSearchUnchanged) return true;

    const searchTerm = personnelSearch.toLowerCase();
    return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm) ||
        p.personnel_code.toLowerCase().includes(searchTerm)
    );
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.personnel_id || !formData.first_name || !formData.last_name) {
        alert("لطفا پرسنل، نام و نام خانوادگی را مشخص کنید.");
        return;
    }
    const dataToSave = {
        ...formData,
        personnel_id: parseInt(formData.personnel_id, 10),
    };

    if (relativeToEdit) {
        onSave({ ...dataToSave, id: relativeToEdit.id });
    } else {
        onSave(dataToSave);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 pt-10 sm:pt-20">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative animate-fade-in-down max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-slate-800 p-2 rounded-full hover:bg-slate-100 transition">
            <CloseIcon/>
        </button>
        <h2 className="text-2xl font-bold mb-6 text-slate-800">{relativeToEdit ? 'ویرایش اطلاعات بستگان' : 'افزودن بستگان'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="relative" ref={dropdownRef}>
              <label htmlFor="personnel_search" className="block text-sm font-medium text-slate-700 mb-1">پرسنل<span className="text-red-500 mr-1">*</span></label>
              <input
                id="personnel_search"
                type="text"
                value={personnelSearch}
                onChange={handlePersonnelSearchChange}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="جستجوی نام یا کد پرسنلی..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required={!formData.personnel_id}
                autoComplete="off"
              />
              {isDropdownOpen && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredPersonnel.length > 0 ? (
                        filteredPersonnel.map(p => (
                            <li
                                key={p.id}
                                onClick={() => handleSelectPersonnel(p)}
                                className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                                {p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})
                            </li>
                        ))
                    ) : (
                        <li className="px-4 py-2 text-sm text-slate-500">پرسنلی یافت نشد.</li>
                    )}
                </ul>
              )}
            </div>
            <div>
                <label htmlFor="relation" className="block text-sm font-medium text-slate-700 mb-1">نسبت</label>
                <input type="text" id="relation" name="relation" value={formData.relation} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-slate-700 mb-1">نام<span className="text-red-500 mr-1">*</span></label>
              <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-slate-700 mb-1">نام خانوادگی<span className="text-red-500 mr-1">*</span></label>
              <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
            </div>
            <div>
                <label htmlFor="national_id" className="block text-sm font-medium text-slate-700 mb-1">کد ملی</label>
                <input type="text" id="national_id" name="national_id" value={formData.national_id} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label htmlFor="birth_date" className="block text-sm font-medium text-slate-700 mb-1">تاریخ تولد</label>
                <input type="text" id="birth_date" name="birth_date" value={formData.birth_date} onChange={handleChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="flex justify-end pt-6 border-t border-slate-200 space-x-2 space-x-reverse">
            <button type="button" onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition font-medium">انصراف</button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">ذخیره</button>
          </div>
        </form>
      </div>
    </div>
  );
};