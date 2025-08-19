import React, { useState, useRef, useEffect } from 'react';
import type { Personnel, AccountingCommitmentWithDetails } from '../types';
import { toPersianDigits, formatRial } from './format';
import { DeleteIcon } from './icons';

interface AccountingCommitmentPageProps {
  personnelList: Personnel[];
}

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
  const [totalFactors, setTotalFactors] = useState<number | ''>('');
  
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [guarantor, setGuarantor] = useState({
      first_name: '',
      last_name: '',
      father_name: '',
      personnel_code: ''
  });

  const [calculation, setCalculation] = useState<{
      ceiling: number;
      previousTotal: number;
      effectiveCeiling: number;
      remaining: number;
      isPermitted: boolean;
  } | null>(null);


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
  
  const generateLetterBody = (personnel: Personnel | null, currentGuarantor: typeof guarantor, loanAmount: number | '') => {
      const template = `احتراماً حسابداری این شرکت تعهد می نماید در صورت عدم پرداخت اقساط وام به مبلغ ${loanAmount ? formatRial(loanAmount) : '[مبلغ وام]'} ریال بنام آقای ${personnel ? `${personnel.first_name} ${personnel.last_name}` : '[نام وام گیرنده]'} فرزند ${personnel ? personnel.father_name : '[نام پدر]'} با کد ملی ${personnel ? toPersianDigits(personnel.national_id) : '[کد ملی]'} از حقوق ضامن نامبرده آقای ${currentGuarantor.first_name || currentGuarantor.last_name ? `${currentGuarantor.first_name} ${currentGuarantor.last_name}` : '[نام ضامن]'} فرزند ${currentGuarantor.father_name || '[نام پدر ضامن]'} با کد ${currentGuarantor.personnel_code ? toPersianDigits(currentGuarantor.personnel_code) : '[کد پرسنلی ضامن]'} در این شرکت شاغل باشد بعد از اعلام بانک و با رعایت سقف قانونی کسر و به حساب آن بانک واریز نماید.\n\nاین گواهی بنا به درخواست نامبرده جهت ارائه به بانک فوق صادر گردیده است و فاقد هرگونه ارزش دیگری می باشد.`;
      setLetterBody(template);
  };
  
  useEffect(() => {
    generateLetterBody(selectedPersonnel, guarantor, amount);
  }, [selectedPersonnel, guarantor, amount]);

  useEffect(() => {
    if (selectedPersonnel && totalFactors !== '' && amount !== '') {
        const previousTotal = commitments
            .filter(c => c.personnel_id === selectedPersonnel.id)
            .reduce((sum, c) => sum + Number(c.amount), 0);
        
        const ceiling = Number(totalFactors) * 30;
        const effectiveCeiling = ceiling - previousTotal;
        const remaining = effectiveCeiling - Number(amount);
        const isPermitted = Number(amount) <= effectiveCeiling;

        setCalculation({ ceiling, previousTotal, effectiveCeiling, remaining, isPermitted });
    } else {
        setCalculation(null);
    }
  }, [selectedPersonnel, totalFactors, amount, commitments]);

  const handleGuarantorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGuarantor(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!title || !letterBody || !selectedPersonnel || !guarantor.first_name || !guarantor.last_name || !date || !amount) {
        alert('لطفاً تمام فیلدهای ستاره‌دار را پر کنید.');
        return;
    }
    
    const commitmentData = {
        title,
        body: letterBody,
        personnel_id: selectedPersonnel.id,
        letter_date: date,
        amount: Number(amount),
        guarantor_first_name: guarantor.first_name,
        guarantor_last_name: guarantor.last_name,
        guarantor_father_name: guarantor.father_name,
        guarantor_personnel_code: guarantor.personnel_code,
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
        setGuarantor({ first_name: '', last_name: '', father_name: '', personnel_code: '' });
        setAmount('');
        setTotalFactors('');
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
  
  const renderCalculation = () => {
      if (!calculation) return null;
      
      const { ceiling, previousTotal, effectiveCeiling, remaining, isPermitted } = calculation;

      return (
        <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-2 text-sm">
            <h3 className="font-bold text-base text-blue-800">نتایج محاسبه سقف تعهد</h3>
            <div className="flex justify-between"><span>سقف تعهد مجاز (۳۰ برابر حکم):</span> <span className="font-semibold">{formatRial(ceiling)} ریال</span></div>
            <div className="flex justify-between"><span>مجموع تعهدات قبلی:</span> <span className="font-semibold text-orange-600">{formatRial(previousTotal)} ریال</span></div>
            <div className="flex justify-between border-t pt-2 mt-2">
                <span className="font-bold">سقف تعهد موثر (پس از کسر تعهدات قبلی):</span>
                <span className="font-bold text-lg">{formatRial(effectiveCeiling)} ریال</span>
            </div>
             <div className="flex justify-between"><span>باقیمانده پس از وام فعلی:</span> <span className="font-semibold">{formatRial(remaining)} ریال</span></div>
            <div className={`flex justify-between items-center p-2 rounded-md mt-2 ${isPermitted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <span className="font-bold text-base">وضعیت:</span>
                <span className="font-bold text-base">{isPermitted ? 'مجاز به دریافت تعهد' : 'غیر مجاز (مبلغ وام بیش از سقف است)'}</span>
            </div>
        </div>
      );
  }

  return (
    <div className="animate-fade-in-up">
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
        
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">ایجاد نامه جدید</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
                <PersonnelSearch 
                    label="وام گیرنده"
                    placeholder="جستجوی وام گیرنده..."
                    personnelList={personnelList}
                    selectedPersonnel={selectedPersonnel}
                    onSelect={setSelectedPersonnel}
                />
                 <div>
                  <label htmlFor="total_factors" className="block text-sm font-medium text-slate-700 mb-1">جمع عوامل حکمی (ریال)<span className="text-red-500 mr-1">*</span></label>
                  <input
                      type="number"
                      id="total_factors"
                      value={totalFactors}
                      onChange={(e) => setTotalFactors(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="مبلغ جمع عوامل حکم"
                  />
                </div>
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">مبلغ وام (ریال)<span className="text-red-500 mr-1">*</span></label>
                  <input
                      type="number"
                      id="amount"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="مبلغ وام درخواستی"
                  />
                </div>
            </div>
            {renderCalculation()}
            <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">اطلاعات ضامن (دستی)</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نام<span className="text-red-500 mr-1">*</span></label>
                        <input name="first_name" value={guarantor.first_name} onChange={handleGuarantorChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نام خانوادگی<span className="text-red-500 mr-1">*</span></label>
                        <input name="last_name" value={guarantor.last_name} onChange={handleGuarantorChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                     </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">نام پدر</label>
                        <input name="father_name" value={guarantor.father_name} onChange={handleGuarantorChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">کد پرسنلی</label>
                        <input name="personnel_code" value={guarantor.personnel_code} onChange={handleGuarantorChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                     </div>
                 </div>
            </div>
            <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">متن نامه (پیش‌نمایش خودکار)</label>
                <textarea
                    value={letterBody}
                    readOnly
                    rows={8}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg shadow-sm leading-relaxed"
                />
            </div>
            <div className="flex justify-end pt-6 mt-4 border-t border-slate-200 space-x-2 space-x-reverse">
                <button onClick={() => handlePrint({ title, body: letterBody, date })} className="px-5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium shadow-sm">چاپ پیش‌نمایش</button>
                <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">ذخیره در آرشیو</button>
            </div>
        </div>

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