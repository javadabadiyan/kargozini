import React, { useState, useEffect } from 'react';
import type { CommitmentLetter } from '../types';

interface EditCommitmentLetterModalProps {
  letter: CommitmentLetter;
  onClose: () => void;
  onSave: (letter: CommitmentLetter) => Promise<void>;
}

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const EditCommitmentLetterModal: React.FC<EditCommitmentLetterModalProps> = ({ letter, onClose, onSave }) => {
  const [formData, setFormData] = useState<CommitmentLetter>(letter);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData(letter);
  }, [letter]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = toEnglishDigits(e.target.value).replace(/,/g, '');
    if (/^\d*$/.test(val)) {
        setFormData(prev => ({ ...prev, loan_amount: Number(val) }));
    }
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
          <h3 className="text-xl font-semibold text-gray-800">ویرایش نامه تعهد</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-sm"><strong>ضامن:</strong> {letter.guarantor_name}</p>
            <hr />
             <div><label className="text-sm">نام وام گیرنده</label><input type="text" name="recipient_name" value={formData.recipient_name} onChange={handleChange} className={inputClass} required/></div>
             <div><label className="text-sm">کد ملی وام گیرنده</label><input type="text" name="recipient_national_id" value={formData.recipient_national_id} onChange={handleChange} className={inputClass} required/></div>
             <div><label className="text-sm">مبلغ وام (ریال)</label><input type="text" name="loan_amount" value={toPersianDigits(formatCurrency(formData.loan_amount))} onChange={handleAmountChange} className={inputClass} required/></div>
             <div><label className="text-sm">نام بانک</label><input type="text" name="bank_name" value={formData.bank_name || ''} onChange={handleChange} className={inputClass} required/></div>
             <div><label className="text-sm">نام شعبه</label><input type="text" name="branch_name" value={formData.branch_name || ''} onChange={handleChange} className={inputClass} required/></div>
             <div><label className="text-sm">شماره نامه ارجاع بانک</label><input type="text" name="reference_number" value={formData.reference_number || ''} onChange={handleChange} className={inputClass}/></div>
          </div>
          
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
            <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100" disabled={isSaving}>
              انصراف
            </button>
            <button type="submit" className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
              {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCommitmentLetterModal;
