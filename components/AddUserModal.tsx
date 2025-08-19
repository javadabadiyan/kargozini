
import React, { useState, useEffect } from 'react';
import type { Personnel } from '../types';
import { CloseIcon } from './icons';

interface AddPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (personnel: Omit<Personnel, 'id'>) => void;
  personnelToEdit?: Personnel | null;
}

export const AddUserModal: React.FC<AddPersonnelModalProps> = ({ isOpen, onClose, onSave, personnelToEdit }) => {
  const [formData, setFormData] = useState<Omit<Personnel, 'id'>>({
    personnel_code: '',
    first_name: '',
    last_name: '',
    father_name: '',
    national_id: '',
    id_number: '',
    birth_date: '',
    birth_place: '',
    issue_date: '',
    issue_place: '',
    marital_status: '',
    military_status: '',
    job: '',
    position: '',
    employment_type: '',
    unit: '',
    service_place: '',
    employment_date: '',
    education_degree: '',
    field_of_study: '',
    status: '',
  });

  useEffect(() => {
    if (isOpen) {
        if (personnelToEdit) {
            const { id, ...editableData } = personnelToEdit;
            setFormData(editableData);
        } else {
            // Reset form for new personnel
            setFormData({
                personnel_code: '', first_name: '', last_name: '', father_name: '',
                national_id: '', id_number: '', birth_date: '', birth_place: '',
                issue_date: '', issue_place: '', marital_status: '', military_status: '',
                job: '', position: '', employment_type: '', unit: '', service_place: '',
                employment_date: '', education_degree: '', field_of_study: '', status: '',
            });
        }
    }
  }, [personnelToEdit, isOpen]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!formData.first_name || !formData.last_name || !formData.personnel_code) {
        alert("لطفا فیلدهای الزامی (کد پرسنلی، نام، نام خانوادگی) را پر کنید.");
        return;
    }
    onSave(formData);
  };

  if (!isOpen) return null;

  const renderInput = (name: keyof Omit<Personnel, 'id'>, label: string, required = false) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">{label}{required && <span className="text-red-500 mr-1">*</span>}</label>
        <input 
            type="text" 
            id={name} 
            name={name}
            value={formData[name]} 
            onChange={handleChange} 
            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            required={required} 
        />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start p-4 pt-10 sm:pt-20">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 relative animate-fade-in-down max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 left-4 text-slate-400 hover:text-slate-800 p-2 rounded-full hover:bg-slate-100 transition">
            <CloseIcon/>
        </button>
        <h2 className="text-2xl font-bold mb-6 text-slate-800">{personnelToEdit ? 'ویرایش پرسنل' : 'افزودن پرسنل جدید'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {renderInput('personnel_code', 'کد پرسنلی', true)}
            {renderInput('first_name', 'نام', true)}
            {renderInput('last_name', 'نام خانوادگی', true)}
            {renderInput('father_name', 'نام پدر')}
            {renderInput('national_id', 'کد ملی')}
            {renderInput('id_number', 'شماره شناسنامه')}
            {renderInput('birth_date', 'تاریخ تولد')}
            {renderInput('birth_place', 'محل تولد')}
            {renderInput('issue_date', 'تاریخ صدور')}
            {renderInput('issue_place', 'محل صدور')}
            {renderInput('marital_status', 'وضعیت تاهل')}
            {renderInput('military_status', 'وضعیت نظام وظیفه')}
            {renderInput('job', 'شغل')}
            {renderInput('position', 'سمت')}
            {renderInput('employment_type', 'نوع استخدام')}
            {renderInput('unit', 'واحد')}
            {renderInput('service_place', 'محل خدمت')}
            {renderInput('employment_date', 'تاریخ استخدام')}
            {renderInput('education_degree', 'مدرک تحصیلی')}
            {renderInput('field_of_study', 'رشته تحصیلی')}
            {renderInput('status', 'وضعیت')}
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