import React, { useState } from 'react';
import type { CommutingMember } from '../types';

interface AddCommutingMemberModalProps {
  onClose: () => void;
  onSave: (member: Omit<CommutingMember, 'id'>) => Promise<void>;
}

const DEFAULT_MEMBER: Omit<CommutingMember, 'id'> = {
  full_name: '',
  personnel_code: '',
  department: '',
  position: '',
};

const AddCommutingMemberModal: React.FC<AddCommutingMemberModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState(DEFAULT_MEMBER);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const fields = [
    { key: 'full_name', label: 'نام و نام خانوادگی' },
    { key: 'personnel_code', label: 'کد پرسنلی' },
    { key: 'department', label: 'واحد' },
    { key: 'position', label: 'سمت' },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">افزودن عضو تردد جدید</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {fields.map(field => (
              <div key={field.key}>
                <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <input
                  type='text'
                  id={field.key}
                  name={field.key}
                  value={formData[field.key as keyof typeof formData]}
                  onChange={handleChange}
                  className={inputClass}
                  required={field.key === 'full_name' || field.key === 'personnel_code'}
                />
              </div>
            ))}
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100" disabled={isSaving}>
              انصراف
            </button>
            <button type="submit" className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'افزودن عضو'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCommutingMemberModal;
