
import React, { useState, useEffect } from 'react';
import type { Personnel } from '../../types';

const PersonnelListPage: React.FC = () => {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/personnel');
        const responseText = await response.text();

        if (!response.ok) {
            let errorMsg = 'خطا در دریافت اطلاعات از سرور';
            try {
                const errorData = JSON.parse(responseText);
                errorMsg = errorData.error || errorData.details || errorMsg;
            } catch (e) {
                errorMsg = responseText || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const data = JSON.parse(responseText);
        if (data.personnel) {
          setPersonnelList(data.personnel);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonnel();
  }, []);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">لیست کامل پرسنل</h2>
      
      <div className="overflow-x-auto">
        <div className="min-w-full inline-block align-middle">
            <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        شناسه
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        نام و نام خانوادگی
                    </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {loading && (
                    <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                        در حال بارگذاری...
                        </td>
                    </tr>
                    )}
                    {error && (
                    <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-red-500">
                        {error}
                        </td>
                    </tr>
                    )}
                    {!loading && !error && personnelList.length > 0 && (
                    personnelList.map((person) => (
                        <tr key={person.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {person.id.toLocaleString('fa-IR', { useGrouping: false })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {person.name}
                        </td>
                        </tr>
                    ))
                    )}
                    {!loading && !error && personnelList.length === 0 && (
                        <tr>
                            <td colSpan={2} className="px-6 py-4 text-center text-gray-500">
                            هیچ پرسنلی یافت نشد.
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PersonnelListPage;