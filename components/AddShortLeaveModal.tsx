import React, { useState } from 'react';
import type { CommutingMember } from '../types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toPersianDigits = (s: string | number | null | undefined): string => {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

interface AddShortLeaveModalProps {
  personnel: CommutingMember;
  guardName: string;
  onClose: () => void;
  onSave: (data: { exitTime: string, returnTime: string }) => Promise<void>;
}

const AddShortLeaveModal: React.FC<AddShortLeaveModalProps> = ({ personnel, guardName, onClose, onSave }) => {
  const [exitTime, setExitTime] = useState({ hour: '', minute: '' });
  const [returnTime, setReturnTime] = useState({ hour: '', minute: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exitTime.hour || !exitTime.minute || !returnTime.hour || !returnTime.minute) {
      setError("لطفا ساعت خروج و بازگشت را به طور کامل مشخص کنید.");
      return;
    }
    setError('');
    setIsSaving(true);
    
    const exitTimeString = `${String(exitTime.hour).padStart(2, '0')}:${String(exitTime.minute).padStart(2, '0')}`;
    const returnTimeString = `${String(returnTime.hour).padStart(2, '0')}:${String(returnTime.minute).padStart(2, '0')}`;

    try {
      await onSave({ exitTime: exitTimeString, returnTime: returnTimeString });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
        onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800">
            ثبت تردد بین ساعتی برای {personnel.full_name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ساعت خروج</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={exitTime.hour} onChange={e => setExitTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                   <option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={exitTime.minute} onChange={e => setExitTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                   <option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ساعت بازگشت</label>
              <div className="grid grid-cols-2 gap-2">
                <select value={returnTime.hour} onChange={e => setReturnTime(p => ({...p, hour: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                   <option value="">ساعت</option>{HOURS.map(h => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}</option>)}
                </select>
                <select value={returnTime.minute} onChange={e => setReturnTime(p => ({...p, minute: e.target.value}))} className="w-full p-2 border border-gray-300 rounded-md font-sans">
                   <option value="">دقیقه</option>{MINUTES.map(m => <option key={m} value={m}>{toPersianDigits(String(m).padStart(2, '0'))}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-lg">
             <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100" disabled={isSaving}>
                انصراف
             </button>
             <button type="submit" className="mr-3 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300" disabled={isSaving}>
                {isSaving ? 'در حال ثبت...' : 'ثبت تردد'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddShortLeaveModal;