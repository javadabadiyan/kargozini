import React, { useState, useEffect } from 'react';
import type { DisciplinaryRecord } from '../types';

interface EditDisciplinaryRecordModalProps {
  record: DisciplinaryRecord;
  onClose: () => void;
  onSave: (record: DisciplinaryRecord) => Promise<void>;
}

const EditDisciplinaryRecordModal: React.FC<EditDisciplinaryRecordModalProps> = ({ record, onClose, onSave }) => {
  const [formData, setFormData] = useState<DisciplinaryRecord>(record);
  const [isSaving, setIsSaving] = useState(false);
  const isNew = !record.id;

  useEffect(() => {
    setFormData(record);
  }, [record]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
  const textAreaClass = `${inputClass} min-h-[100px]`;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">
            {isNew ? 'افزودن رکورد انضباطی جدید' : `ویرایش رکورد برای ${record.full_name}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">نام و نام خانوادگی</label>
                    <input type="text" id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} className={inputClass} required />
                </div>
                <div>
                    <label htmlFor="personnel_code" className="block text-sm font-medium text-gray-700 mb-1">کد پرسنلی</label>
                    <input type="text" id="personnel_code" name="personnel_code" value={formData.personnel_code} onChange={handleChange} className={inputClass} required />
                </div>
            </div>
            <div>
                <label htmlFor="meeting_date" className="block text-sm font-medium text-gray-700 mb-1">تاریخ جلسه</label>
                <input type="text" id="meeting_date" name="meeting_date" value={formData.meeting_date} onChange={handleChange} className={inputClass} placeholder="مثال: ۱۴۰۳/۰۵/۱۵" />
            </div>
            <div>
                <label htmlFor="letter_description" className="block text-sm font-medium text-gray-700 mb-1">شرح نامه ارسالی</label>
                <textarea id="letter_description" name="letter_description" value={formData.letter_description} onChange={handleChange} className={textAreaClass}></textarea>
            </div>
             <div>
                <label htmlFor="final_decision" className="block text-sm font-medium text-gray-700 mb-1">رای نهایی کمیته</label>
                <textarea id="final_decision" name="final_decision" value={formData.final_decision} onChange={handleChange} className={textAreaClass}></textarea>
            </div>
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100" disabled={isSaving}>
              انصراف
            </button>
            <button type="submit" className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : (isNew ? 'افزودن رکورد' : 'ذخیره تغییرات')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDisciplinaryRecordModal;