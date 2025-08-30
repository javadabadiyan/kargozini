
import React, { useState, useEffect, useMemo } from 'react';
import { SearchIcon, UserIcon, UsersIcon } from '../icons/Icons';
import type { Personnel } from '../../types';

const DependentsInfoPage: React.FC = () => {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonnel = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch all personnel records to enable comprehensive client-side searching
        const response = await fetch('/api/personnel?pageSize=100000');

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg = 'خطا در دریافت اطلاعات از سرور';
          try {
            const errorData = JSON.parse(errorText);
            errorMsg = errorData.error || errorData.details || errorMsg;
          } catch (e) {
             errorMsg = errorText || errorMsg;
          }
          throw new Error(errorMsg);
        }
        
        const data = await response.json();
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

  const filteredPersonnel = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return personnelList;
    return personnelList.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
      p.personnel_code.toLowerCase().includes(lowercasedTerm) ||
      (p.national_id && p.national_id.toLowerCase().includes(lowercasedTerm))
    );
  }, [personnelList, searchTerm]);

  const handleSelectPersonnel = (personnel: Personnel) => {
    setSelectedPersonnel(personnel);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">اطلاعات بستگان</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Search and Personnel List Column */}
        <div className="md:col-span-1">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <label htmlFor="search-personnel" className="block text-sm font-medium text-gray-700 mb-2">
              جستجوی پرسنل
            </label>
            <div className="relative">
              <input 
                type="text" 
                id="search-personnel" 
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="نام، کد پرسنلی، کد ملی..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            
            <div className="mt-4 max-h-80 overflow-y-auto">
              {loading && <p className="text-center text-gray-500">در حال بارگذاری...</p>}
              {error && <p className="text-center text-red-500">{error}</p>}
              {!loading && !error && (
                <ul className="space-y-2">
                  {filteredPersonnel.map(person => (
                    <li 
                      key={person.id}
                      onClick={() => handleSelectPersonnel(person)}
                      className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${selectedPersonnel?.id === person.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-200'}`}
                    >
                      <UserIcon className="w-5 h-5 ml-2" />
                      {person.first_name} {person.last_name}
                    </li>
                  ))}
                   {filteredPersonnel.length === 0 && <p className="text-center text-gray-500">پرسنلی یافت نشد.</p>}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Selected Personnel Info Column */}
        <div className="md:col-span-2">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-96 flex items-center justify-center">
              {selectedPersonnel ? (
                <div className="text-center text-gray-700">
                   <UserIcon className="w-20 h-20 mx-auto mb-4 text-blue-500" />
                   <h3 className="text-2xl font-bold">{selectedPersonnel.first_name} {selectedPersonnel.last_name}</h3>
                   {/* FIX: personnel_code is a string and toLocaleString with arguments is for numbers. Displaying the string directly. */}
                   <p className="text-md mt-2">کد پرسنلی: <span className="font-mono">{selectedPersonnel.personnel_code}</span></p>
                   <p className="mt-4 text-gray-500">اطلاعات بستگان این شخص در اینجا نمایش داده خواهد شد.</p>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                    <UsersIcon className="w-16 h-16 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">اطلاعات پرسنل</h3>
                    <p className="text-sm">برای مشاهده اطلاعات بستگان، یک پرسنل را از لیست انتخاب کنید.</p>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DependentsInfoPage;
