
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
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input 
            type="text" 
            id={name} 
            name={name}
            value={formData[name]} 
            onChange={handleChange} 
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" 
            required={required} 
        />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative animate-fade-in-down max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800">
            <CloseIcon/>
        </button>
        <h2 className="text-2xl font-bold mb-6 text-gray-800">{personnelToEdit ? 'ویرایش پرسنل' : 'افزودن پرسنل جدید'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div className="flex justify-end pt-4 space-x-2 space-x-reverse">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition">انصراف</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">ذخیره</button>
          </div>
        </form>
      </div>
    </div>
  );
};
