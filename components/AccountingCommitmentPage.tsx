import React, { useState, useRef, useEffect } from 'react';
import type { Personnel, AccountingCommitmentWithDetails } from '../types';
import { toPersianDigits, formatRial } from './format';
import { DeleteIcon } from './icons';

interface AccountingCommitmentPageProps {
  personnelList: Personnel[];
}

// Reusable Personnel Search Component
const PersonnelSearch = ({
  personnelList,
  selectedPersonnel,
  onSelect,
  label,
  placeholder,
}: {
  personnelList: Personnel[];
  selectedPersonnel: Personnel | null;
  onSelect: (p: Personnel | null) => void;
  label: string;
  placeholder: string;
}) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(selectedPersonnel ? `${selectedPersonnel.first_name} ${selectedPersonnel.last_name} (${toPersianDigits(selectedPersonnel.personnel_code)})` : '');
  }, [selectedPersonnel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSelect(null);
    if (!isOpen) setIsOpen(true);
  };

  const handleSelectPersonnel = (p: Personnel) => {
    onSelect(p);
    setIsOpen(false);
  };

  const filteredPersonnel = personnelList.filter(p => {
    if (!search || selectedPersonnel) return false;
    const searchTerm = search.toLowerCase();
    return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm) ||
        p.personnel_code.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}<span className="text-red-500 mr-1">*</span></label>
      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
      {isOpen && filteredPersonnel.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredPersonnel.map(p => (
            <li
              key={p.id}
              onClick={() => handleSelectPersonnel(p)}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


export const AccountingCommitmentPage: React.FC<AccountingCommitmentPageProps> = ({ personnelList }) => {
  const [title, setTitle] = useState('تعهد حسابداری');
  const [letterBody, setLetterBody] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }));
  const [amount, setAmount] = useState<number | ''>('');
  
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [selectedGuarantor, setSelectedGuarantor] = useState<Personnel | null>(null);
  const [previousCommitmentsCount, setPreviousCommitmentsCount] = useState(0);

  const [commitments, setCommitments] = useState<AccountingCommitmentWithDetails[]>([]);
  const [filteredCommitments, setFilteredCommitments] = useState<AccountingCommitmentWithDetails[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const printableContentRef = useRef<HTMLDivElement>(null);
  const [printableData, setPrintableData] = useState({ title: '', body: '', date: '' });
  
  const fetchCommitments = async () => {
    setIsLoading(true);
    try {
        const response = await fetch('/api/commitments');
        if (!response.ok) throw new Error('Failed to fetch commitments');
        const data = await response.json();
        setCommitments(data);
    } catch (error) {
        console.error(error);
        alert('خطا در بارگذاری آرشیو نامه‌ها');
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCommitments();
  }, []);

  useEffect(() => {
    const filtered = commitments.filter(c =>
        `${c.personnel_first_name} ${c.personnel_last_name}`.includes(searchQuery) ||
        `${c.guarantor_first_name} ${c.guarantor_last_name}`.includes(searchQuery) ||
        toPersianDigits(c.letter_date).includes(searchQuery)
    );
    setFilteredCommitments(filtered);
  }, [searchQuery, commitments]);
  
  useEffect(() => {
    if (selectedPersonnel) {
        const count = commitments.filter(c => c.personnel_id === selectedPersonnel.id).length;
        setPreviousCommitmentsCount(count);
    } else {
        setPreviousCommitmentsCount(0);
    }
  }, [selectedPersonnel, commitments]);

  const generateLetterBody = (personnel: Personnel | null, guarantor: Personnel | null, loanAmount: number | '') => {
      const template = `احتراماً حسابداری این شرکت تعهد می نماید در صورت عدم پرداخت اقساط وام به مبلغ ${loanAmount ? formatRial(loanAmount) : '[مبلغ وام]'} ریال بنام آقای ${personnel ? `${personnel.first_name} ${personnel.last_name}` : '[نام وام گیرنده]'} فرزند ${personnel ? personnel.father_name : '[نام پدر]'} با کد ملی ${personnel ? toPersianDigits(personnel.national_id) : '[کد ملی]'} از حقوق ضامن نامبرده آقای ${guarantor ? `${guarantor.first_name} ${guarantor.last_name}` : '[نام ضامن]'} فرزند ${guarantor ? guarantor.father_name : '[نام پدر ضامن]'} با کد ${guarantor ? toPersianDigits(guarantor.personnel_code) : '[کد پرسنلی ضامن]'} در این شرکت شاغل باشد بعد از اعلام بانک و با رعایت سقف قانونی کسر و به حساب آن بانک واریز نماید.\n\nاین گواهی بنا به درخواست نامبرده جهت ارائه به بانک فوق صادر گردیده است و فاقد هرگونه ارزش دیگری می باشد.`;
      setLetterBody(template);
  };
  
  useEffect(() => {
    generateLetterBody(selectedPersonnel, selectedGuarantor, amount);
  }, [selectedPersonnel, selectedGuarantor, amount]);

  const handleSave = async () => {
    if (!title || !letterBody || !selectedPersonnel || !selectedGuarantor || !date || !amount) {
        alert('لطفاً تمام فیلدهای ستاره‌دار را پر کنید.');
        return;
    }
    
    const commitmentData = {
        title,
        body: letterBody,
        personnel_id: selectedPersonnel.id,
        guarantor_personnel_id: selectedGuarantor.id,
        letter_date: date,
        amount: Number(amount)
    };

    try {
        const response = await fetch('/api/commitments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commitmentData),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save');
        }
        await fetchCommitments(); // Refresh list
        alert('نامه تعهد با موفقیت ذخیره شد.');
        // Reset form
        setSelectedPersonnel(null);
        setSelectedGuarantor(null);
        setAmount('');
    } catch(e) {
        alert(`خطا در ذخیره سازی: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('آیا از حذف این نامه اطمینان دارید؟')) {
        try {
            const response = await fetch(`/api/commitments?id=${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete');
            await fetchCommitments();
        } catch(e) {
            alert('خطا در حذف نامه');
        }
    }
  };

  const handlePrint = (commitment: { title: string, body: string, date: string }) => {
    setPrintableData(commitment);
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="animate-fade-in-up">
      {/* Printable Area (Hidden) */}
      <div className="hidden print:block printable-area">
          <div className="flex justify-between items-start mb-12">
            <div className="text-sm">تاریخ: {toPersianDigits(printableData.date)}</div>
            <div className="text-sm">شماره: .................</div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">ریاست محترم بانک رفاه شعبه مرکزی سیرجان</h1>
          <h2 className="text-xl text-center mb-12">موضوع: {printableData.title}</h2>
          <p className="leading-loose text-lg text-justify whitespace-pre-line">{printableData.body}</p>
          <div className="mt-24 text-center">
            <p>با تشکر</p>
            <p className="font-bold">مدیریت سرمایه انسانی</p>
          </div>
      </div>

      <div className="no-print">
        <h1 className="text-3xl font-bold text-slate-700 mb-6">نامه تعهد حسابداری</h1>
        
        {/* New Commitment Form */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">ایجاد نامه جدید</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <PersonnelSearch 
                    label="وام گیرنده"
                    placeholder="جستجوی وام گیرنده..."
                    personnelList={personnelList}
                    selectedPersonnel={selectedPersonnel}
                    onSelect={setSelectedPersonnel}
                />
                <PersonnelSearch 
                    label="ضامن"
                    placeholder="جستجوی ضامن..."
                    personnelList={personnelList}
                    selectedPersonnel={selectedGuarantor}
                    onSelect={setSelectedGuarantor}
                />
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">مبلغ وام (ریال)<span className="text-red-500 mr-1">*</span></label>
                  <input
                      type="number"
                      id="amount"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="مثال: 300000000"
                  />
                </div>
            </div>
            {selectedPersonnel && <p className="text-sm text-blue-600 mb-4">تعداد تعهدات قبلی این شخص: {toPersianDigits(previousCommitmentsCount)}</p>}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">متن نامه (پیش‌نمایش خودکار)</label>
                <textarea
                    value={letterBody}
                    readOnly
                    rows={8}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg shadow-sm"
                />
            </div>
            <div className="flex justify-end pt-6 mt-4 border-t border-slate-200 space-x-2 space-x-reverse">
                <button onClick={() => handlePrint({ title, body: letterBody, date })} className="px-5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium shadow-sm">چاپ پیش‌نمایش</button>
                <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">ذخیره در آرشیو</button>
            </div>
        </div>

        {/* Saved Commitments Archive */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">آرشیو نامه‌های ذخیره شده</h2>
            <input
                type="text"
                placeholder="جستجو در آرشیو..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-1/3 mb-4 px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
             <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">وام گیرنده</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">ضامن</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">مبلغ</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">تاریخ</th>
                            <th className="relative px-4 py-3"><span className="sr-only">عملیات</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-500">در حال بارگذاری...</td></tr>
                        ) : filteredCommitments.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-slate-500">هیچ نامه‌ای یافت نشد.</td></tr>
                        ) : (
                            filteredCommitments.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{c.personnel_first_name} {c.personnel_last_name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{c.guarantor_first_name} {c.guarantor_last_name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{formatRial(c.amount)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-700">{toPersianDigits(c.letter_date)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-left text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-4 space-x-reverse">
                                            <button onClick={() => handlePrint({ title: c.title, body: c.body, date: c.letter_date })} className="text-slate-500 hover:text-blue-600 transition" title="چاپ">چاپ</button>
                                            <button onClick={() => handleDelete(c.id)} className="text-slate-500 hover:text-red-600 transition" title="حذف"><DeleteIcon className="w-5 h-5"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
        </div>
      </div>
    </div>
  );
};