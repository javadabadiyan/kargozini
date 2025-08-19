import React from 'react';
import type { Personnel } from '../types';
import { CloseIcon } from './icons';
import { tableHeaders } from './UserTable';

interface ViewPersonnelModalProps {
  isOpen: boolean;
  onClose: () => void;
  personnel: Personnel | null;
}

const DetailItem = ({ label, value }: { label: string, value: any }) => (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 px-2 even:bg-gray-50">
        <dt className="text-sm font-medium text-gray-600">{label}</dt>
        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || '-'}</dd>
    </div>
);

export const ViewPersonnelModal: React.FC<ViewPersonnelModalProps> = ({ isOpen, onClose, personnel }) => {
  if (!isOpen || !personnel) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative animate-fade-in-down max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 left-4 text-gray-500 hover:text-gray-800">
            <CloseIcon/>
        </button>
        <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-4">اطلاعات پرسنل</h2>
        <dl className="-mx-6">
            {tableHeaders.map(header => (
                <DetailItem 
                    key={header.key} 
                    label={header.label} 
                    value={personnel[header.key as keyof Personnel]} 
                />
            ))}
        </dl>
        <div className="flex justify-end pt-6 mt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition">بستن</button>
        </div>
      </div>
    </div>
  );
};
