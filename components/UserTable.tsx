
import React from 'react';
import type { Personnel } from '../types';
import { EditIcon, DeleteIcon } from './icons';

interface PersonnelTableProps {
  personnel: Personnel[];
  onEdit: (personnel: Personnel) => void;
  onDelete: (personnelId: number) => void;
}

const tableHeaders = [
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
    { key: 'job', label: 'شغل' },
    { key: 'position', label: 'سمت' },
    { key: 'employment_type', label: 'نوع استخدام' },
    { key: 'unit', label: 'واحد' },
    { key: 'service_place', label: 'محل خدمت' },
    { key: 'employment_date', label: 'تاریخ استخدام' },
    { key: 'education_degree', label: 'مدرک تحصیلی' },
    { key: 'field_of_study', label: 'رشته تحصیلی' },
    { key: 'status', label: 'وضعیت' },
];

export const UserTable: React.FC<PersonnelTableProps> = ({ personnel, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {tableHeaders.map(header => (
                <th key={header.key} scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {header.label}
                </th>
            ))}
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">عملیات</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {personnel.length === 0 ? (
            <tr>
              <td colSpan={tableHeaders.length + 1} className="px-6 py-12 text-center text-gray-500">
                هیچ پرسنلی یافت نشد.
              </td>
            </tr>
          ) : (
            personnel.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                {tableHeaders.map(header => (
                    <td key={header.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {p[header.key as keyof Personnel]}
                    </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                  <div className="flex items-center justify-end space-x-4 space-x-reverse">
                    <button onClick={() => onEdit(p)} className="text-indigo-600 hover:text-indigo-900 transition">
                      <EditIcon />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="text-red-600 hover:text-red-900 transition">
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
