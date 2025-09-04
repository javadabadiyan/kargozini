import React from 'react';
import type { Personnel } from '../types';

interface RetirementInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  personnel: (Personnel & { age?: number; serviceYears?: number })[];
  mode?: 'age' | 'service';
}

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const RetirementInfoModal: React.FC<RetirementInfoModalProps> = ({ isOpen, onClose, title, personnel, mode = 'age' }) => {
  if (!isOpen) return null;

  const headers = mode === 'age'
    ? ['نام کامل', 'کد پرسنلی', 'تاریخ تولد', 'سن']
    : ['نام کامل', 'کد پرسنلی', 'تاریخ استخدام', 'سابقه (سال)'];


  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
          <h3 id="modal-title" className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {title} ({toPersianDigits(personnel.length)} نفر)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            aria-label="بستن"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                 {headers.map(header => (
                  <th key={header} className="px-4 py-3 text-right text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {personnel.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">{p.first_name} {p.last_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{toPersianDigits(p.personnel_code)}</td>
                  {mode === 'age' ? (
                    <>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{toPersianDigits(p.birth_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{toPersianDigits(p.age)}</td>
                    </>
                  ) : (
                     <>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{toPersianDigits(p.hire_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{toPersianDigits(p.serviceYears)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end items-center p-4 border-t bg-gray-50 dark:bg-slate-900/50 dark:border-slate-700 rounded-b-lg mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:bg-slate-600 dark:text-gray-200 dark:border-slate-500 dark:hover:bg-slate-500"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};

export default RetirementInfoModal;