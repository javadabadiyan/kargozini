import React, { useState, useEffect } from 'react';
import type { Dependent } from '../types';

interface EditDependentModalProps {
  dependent: Dependent;
  onClose: () => void;
  onSave: (dependent: Dependent) => Promise<void>;
}

const EditDependentModal: React.FC<EditDependentModalProps> = ({ dependent, onClose, onSave }) => {
  const [formData, setFormData] = useState<Dependent>(dependent);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(dependent);
  }, [dependent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  const fields: { key: keyof Omit<Dependent, 'id' | 'personnel_code'>; label: string }[] = [
    { key: 'first_name', label: 'نام' },
    { key: 'last_name', label: 'نام خانوادگی' },
    { key: 'father_name', label: 'نام پدر' },
    { key: 'relation_type', label: 'نسبت' },
    { key: 'birth_date', label: 'تاریخ تولد' },
    { key: 'gender', label: 'جنسیت' },
    { key: 'birth_month', label: 'ماه تولد' },
    { key: 'birth_day', label: 'روز تولد' },
    { key: 'id_number', label: 'شماره شناسنامه' },
    { key: 'national_id', label: 'کد ملی بستگان' },
    { key: 'issue_place', label: 'محل صدور شناسنامه' },
    { key: 'insurance_type', label: 'نوع بیمه شده' },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-800">
            ویرایش اطلاعات {dependent.first_name} {dependent.last_name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
            aria-label="بستن"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              {fields.map(field => (
                <div key={field.key}>
                  <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <input
                    type='text'
                    id={field.key}
                    name={field.key}
                    value={String(formData[field.key as keyof typeof formData] ?? '')}
                    onChange={handleChange}
                    className={inputClass}
                    readOnly={field.key === 'national_id'} 
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg mt-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
              disabled={isSaving}
            >
              انصراف
            </button>
            <button 
              type="submit"
              className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              disabled={isSaving}
            >
              {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDependentModal;