import React, { useState, useEffect } from 'react';
import type { Personnel } from '../types';

interface EditPersonnelModalProps {
  personnel: Personnel;
  onClose: () => void;
  onSave: (personnel: Personnel) => Promise<void>;
}

const EditPersonnelModal: React.FC<EditPersonnelModalProps> = ({ personnel, onClose, onSave }) => {
  const [formData, setFormData] = useState<Personnel>(personnel);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(personnel);
  }, [personnel]);

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

  const fields: { key: keyof Omit<Personnel, 'id'>; label: string; type?: string }[] = [
    { key: 'personnel_code', label: 'کد پرسنلی' },
    { key: 'first_name', label: 'نام' },
    { key: 'last_name', label: 'نام خانوادگی' },
    { key: 'father_name', label: 'نام پدر' },
    { key: 'national_id', label: 'کد ملی' },
    { key: 'id_number', label: 'شماره شناسنامه' },
    { key: 'birth_date', label: 'تاریخ تولد' },
    { key: 'birth_place', label: 'محل تولد' },
    { key: 'issue_date', label: 'تاریخ صدور' },
    { key: 'issue_place', label: 'محل صدور' },
    { key: 'marital_status', label: 'وضعیت تاهل' },
    { key: 'military_status', label: 'وضعیت نظام وظیفه' },
    { key: 'job_title', label: 'شغل' },
    { key: 'position', label: 'سمت' },
    { key: 'employment_type', label: 'نوع استخدام' },
    { key: 'department', label: 'واحد' },
    { key: 'service_location', label: 'محل خدمت' },
    { key: 'hire_date', label: 'تاریخ استخدام' },
    { key: 'education_level', label: 'مدرک تحصیلی' },
    { key: 'field_of_study', label: 'رشته تحصیلی' },
    { key: 'status', label: 'وضعیت' },
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
            ویرایش اطلاعات {personnel.first_name} {personnel.last_name}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
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
                  <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type || 'text'}
                    id={field.key}
                    name={field.key}
                    value={String(formData[field.key] ?? '')}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg mt-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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

export default EditPersonnelModal;
