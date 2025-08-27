
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
        const response = await fetch('/api/personnel');
        const responseText = await response.text();

        if (!response.ok) {
          let errorMsg = 'خطا در دریافت اطلاعات از سرور';
          try {
            const errorData = JSON.parse(responseText);
            errorMsg = errorData.error || errorData.details || errorMsg;
          } catch (e) {
            // response is not json, use text as error if available
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

  const filteredPersonnel = useMemo(() =>
    personnelList.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [personnelList, searchTerm]);

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
              جستجو بر اساس نام پرسنل
            </label>
            <div className="relative">
              <input 
                type="text" 
                id="search-personnel" 
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="نام پرسنل را وارد کنید..."
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
                      {person.name}
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
                   <h3 className="text-2xl font-bold">{selectedPersonnel.name}</h3>
                   <p className="text-md mt-2">شناسه پرسنلی: <span className="font-mono">{selectedPersonnel.id.toLocaleString('fa-IR', { useGrouping: false })}</span></p>
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