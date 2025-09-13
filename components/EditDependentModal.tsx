import React, { useState, useEffect } from 'react';
import type { Dependent } from '../types';

interface EditDependentModalProps {
  dependent: Partial<Dependent>;
  onClose: () => void;
  onSave: (dependent: Partial<Dependent>) => Promise<void>;
}

const EditDependentModal: React.FC<EditDependentModalProps> = ({ dependent, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Dependent>>(dependent);
  const [isSaving, setIsSaving] = useState(false);
  
  const isNew = !dependent.id;

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

  const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-gray-200";

  const fields: { key: keyof Omit<Dependent, 'id'>; label: string }[] = [
    { key: 'personnel_code', label: 'کد پرسنلی' },
    { key: 'first_name', label: 'نام' },
    { key: 'last_name', label: 'نام خانوادگی' },
    { key: 'father_name', label: 'نام پدر' },
    { key: 'relation_type', label: 'نسبت' },
    { key: 'birth_date', label: 'تاريخ تولد' },
    { key: 'gender', label: 'جنسيت' },
    { key: 'birth_month', label: 'ماه تولد' },
    { key: 'birth_day', label: 'روز تولد' },
    { key: 'id_number', label: 'شماره شناسنامه' },
    { key: 'national_id', label: 'كد ملي بستگان' },
    { key: 'guardian_national_id', label: 'كد ملي سرپرست' },
    { key: 'issue_place', label: 'محل صدور شناسنامه' },
    { key: 'insurance_type', label: 'نوع' },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-800 dark:text-slate-100">
            {isNew ? 'افزودن وابسته جدید' : `ویرایش اطلاعات ${dependent.first_name || ''} ${dependent.last_name || ''}`}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            aria-label="بستن"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-y-auto p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
              {fields.map(field => (
                <div key={field.key}>
                  <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={'text'}
                    id={field.key}
                    name={field.key}
                    value={String(formData[field.key as keyof typeof formData] ?? '')}
                    onChange={handleChange}
                    className={inputClass}
                    readOnly={(field.key === 'personnel_code' || field.key === 'national_id') && !isNew}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 dark:bg-slate-900/50 dark:border-slate-700 rounded-b-xl mt-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-slate-600 dark:text-gray-200 dark:border-slate-500 dark:hover:bg-slate-500"
              disabled={isSaving}
            >
              انصراف
            </button>
            <button 
              type="submit"
              className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              disabled={isSaving}
            >
              {isSaving ? 'در حال ذخیره...' : (isNew ? 'افزودن وابسته' : 'ذخیره تغییرات')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDependentModal;
