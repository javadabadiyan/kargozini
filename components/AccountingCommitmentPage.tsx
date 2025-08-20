import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Personnel, AccountingCommitment, AccountingCommitmentWithDetails } from '../types';
import { toPersianDigits, formatRial, toEnglishDigits } from './format';
import { CloseIcon, UploadIcon, EyeIcon, EditIcon, DeleteIcon, ChevronDownIcon, PhoneIcon, GlobeIcon, MailIcon, LocationIcon } from './icons';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// --- Local Components ---

const PersonnelSearch = ({
  personnelList,
  onSelect,
  label,
  placeholder,
  value,
  onChange,
}: {
  personnelList: Personnel[];
  onSelect: (p: Personnel) => void;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    onChange(e.target.value);
    if (!isOpen) setIsOpen(true);
  };
  
  const handleSelectPersonnel = (p: Personnel) => {
    onSelect(p);
    setIsOpen(false);
  };

  const filteredPersonnel = useMemo(() => {
    if (!value) return [];
    const searchTerm = value.toLowerCase();
    return personnelList.filter(p => (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm) ||
        p.personnel_code.toLowerCase().includes(searchTerm)
    ));
  }, [value, personnelList]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleSearchChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
      {isOpen && value && filteredPersonnel.length > 0 && (
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

const PrintableLetter = React.forwardRef<HTMLDivElement, { commitment: AccountingCommitmentWithDetails }>(({ commitment }, ref) => (
    <div ref={ref} className="w-[148mm] h-[210mm] bg-white relative p-6 mx-auto flex flex-col font-['Vazirmatn'] text-black overflow-hidden print:shadow-none print:m-0">
      {/* Decorative Side Bar */}
      <div className="absolute top-0 right-0 h-full w-[12mm] bg-[#333745]"></div>
      <div className="absolute top-0 right-[4mm] h-full w-[4mm] bg-[#366FB3]"></div>
      <div className="absolute top-[25mm] right-0 w-[24mm] h-[12mm] bg-[#F3D04E]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 20% 50%)'}}></div>

      {/* Header */}
      <header className="flex-shrink-0">
        <h1 className="text-center text-2xl font-bold mb-8">بسمه تعالی</h1>
        <div className="flex justify-between items-start text-sm">
          <div className="space-y-2">
            <p>تاریخ : <span className="font-semibold">{toPersianDigits(commitment.letter_date)}</span></p>
            <p>شماره : ........................</p>
            <p>پیوست : ........................</p>
          </div>
          <div className="text-center -mr-8">
             <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center bg-white border-4 border-blue-600 shadow-md">
               <p className="text-gray-400 text-xs">Logo</p>
             </div>
             <h2 className="font-bold text-lg mt-2">شرکت نگین گهر خاورمیانه</h2>
             <p className="text-xs">Negin Gohar Khavarmianeh Co.</p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-grow pt-8 text-justify text-base leading-loose">
         <h2 className="text-xl font-bold mb-4">{commitment.addressee}</h2>
         <h3 className="text-lg font-semibold mb-6">موضوع: {commitment.title}</h3>
         <p style={{ whiteSpace: 'pre-line' }}>{commitment.body}</p>
      </main>
      
      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 text-xs flex-shrink-0">
        <div className="h-1 bg-red-500"></div>
        <div className="bg-[#F3D04E] p-1 flex justify-around items-center text-black font-semibold">
            <div className="flex items-center gap-1"><PhoneIcon /><span>فکس : ۳۲۲۷۱۲۲۰-۰۳۴</span></div>
            <div className="flex items-center gap-1"><PhoneIcon /><span>تلفن : ۳۲۲۷۱۶۸۱۳-۰۳۴ | ۳۲۲۷۱۲۲۰۹-۰۳۴</span></div>
            <div className="flex items-center gap-1"><GlobeIcon /><span>www.negingoharco.com</span></div>
            <div className="flex items-center gap-1"><MailIcon /><span>info@negingoharco.com</span></div>
        </div>
        <div className="flex justify-between items-center text-black px-4 py-1">
           <div className="flex items-center gap-1"><LocationIcon /><span>آدرس : بلوار پارادیس – بلوار مهاجرین – کوچه مهاجرین ۹ – پلاک ۱۱۷ – طبقه همکف – کد پستی ۷۶۱۴۷۶۴۱۹۳</span></div>
           <div className="flex items-center gap-2">
              <div className="w-12 h-6 bg-gray-200 flex items-center justify-center text-gray-500 text-[8px]">ISO</div>
              <div className="w-12 h-6 bg-gray-200 flex items-center justify-center text-gray-500 text-[8px]">ISO</div>
              <div className="w-12 h-6 bg-gray-200 flex items-center justify-center text-gray-500 text-[8px]">ISO</div>
           </div>
        </div>
      </footer>
    </div>
));

const ViewLetterModal = ({ commitment, onClose }: { commitment: AccountingCommitmentWithDetails | null; onClose: () => void; }) => {
  if (!commitment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 no-print">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800">نمایش نامه تعهد</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
                <CloseIcon />
            </button>
        </div>
        <div className="overflow-auto flex-1 bg-slate-100 p-4 rounded-md printable-area">
           <PrintableLetter commitment={commitment} />
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 transition ml-2">بستن</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">چاپ</button>
        </div>
      </div>
    </div>
  );
};

const CommitmentArchive = ({ 
    commitments, onView, onEdit, onDelete 
} : {
    commitments: AccountingCommitmentWithDetails[],
    onView: (c: AccountingCommitmentWithDetails) => void,
    onEdit: (c: AccountingCommitmentWithDetails) => void,
    onDelete: (id: number) => void,
}) => {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const groupedCommitments = useMemo(() => {
        const groups = commitments.reduce((acc, c) => {
            const borrowerName = `${c.personnel_first_name} ${c.personnel_last_name}`;
            const key = c.personnel_id ? `p_${c.personnel_id}` : `e_${borrowerName}`;
            if (!acc[key]) {
                acc[key] = { borrowerName, commitments: [], totalAmount: 0 };
            }
            acc[key].commitments.push(c);
            acc[key].totalAmount += Number(c.amount);
            return acc;
        }, {} as Record<string, { borrowerName: string; commitments: AccountingCommitmentWithDetails[]; totalAmount: number }>);
        return Object.values(groups).sort((a,b) => a.borrowerName.localeCompare(b.borrowerName));
    }, [commitments]);

    const toggleExpand = (key: string) => {
        setExpandedKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else newSet.add(key);
            return newSet;
        });
    };

    if (commitments.length === 0) return <div className="text-center py-8 bg-slate-50 rounded-lg"><p className="text-slate-500">هیچ نامه تعهدی در آرشیو ذخیره نشده است.</p></div>;

    return (
        <div className="overflow-x-auto bg-white rounded-xl shadow-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="w-12"></th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">وام گیرنده</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">تعداد نامه</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">جمع مبلغ تعهدات (ریال)</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {groupedCommitments.map(group => {
                         const groupKey = group.borrowerName;
                         return (
                            <React.Fragment key={groupKey}>
                                <tr className="hover:bg-slate-50/70 cursor-pointer" onClick={() => toggleExpand(groupKey)}>
                                    <td className="px-4 py-4 text-slate-400"><ChevronDownIcon className={`w-5 h-5 transition-transform ${expandedKeys.has(groupKey) ? 'rotate-180' : ''}`} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{group.borrowerName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(group.commitments.length)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{formatRial(group.totalAmount)}</td>
                                </tr>
                                {expandedKeys.has(groupKey) && (
                                    <tr>
                                        <td colSpan={4} className="p-0"><div className="p-4 bg-slate-50">
                                            <table className="min-w-full divide-y divide-slate-200 bg-white rounded-md shadow-inner">
                                                <thead className="bg-slate-100">
                                                    <tr>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">تاریخ</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">مبلغ (ریال)</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">ضامن</th>
                                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">گیرنده</th>
                                                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-500">عملیات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                {group.commitments.map(c => (
                                                    <tr key={c.id}>
                                                        <td className="px-4 py-3 text-sm">{toPersianDigits(c.letter_date)}</td>
                                                        <td className="px-4 py-3 text-sm font-mono">{formatRial(c.amount)}</td>
                                                        <td className="px-4 py-3 text-sm">{c.guarantor_first_name} {c.guarantor_last_name}</td>
                                                        <td className="px-4 py-3 text-sm truncate max-w-xs">{c.addressee}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center space-x-3 space-x-reverse">
                                                                <button onClick={() => onView(c)} className="text-slate-400 hover:text-green-600 transition" title="نمایش و چاپ"><EyeIcon className="w-5 h-5" /></button>
                                                                <button onClick={() => onEdit(c)} className="text-slate-400 hover:text-indigo-600 transition" title="ویرایش"><EditIcon className="w-5 h-5" /></button>
                                                                <button onClick={() => onDelete(c.id)} className="text-slate-400 hover:text-red-600 transition" title="حذف"><DeleteIcon className="w-5 h-5" /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div></td>
                                    </tr>
                                )}
                            </React.Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
}

// --- Main Page Component ---

const initialFormState = {
  id: null as number | null,
  addressee: 'ریاست محترم بانک رفاه شعبه مرکزی سیرجان',
  title: 'تعهد حسابداری',
  letter_date: new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'),
  amount: '' as number | '',
  personnel_id: null as number | null,
  borrower_search: '',
  borrower_first_name: '',
  borrower_last_name: '',
  borrower_father_name: '',
  borrower_national_id: '',
  guarantor_search: '',
  guarantor_first_name: '',
  guarantor_last_name: '',
  total_factors: '' as number | '',
};

export const AccountingCommitmentPage: React.FC<{ personnelList: Personnel[] }> = ({ personnelList }) => {
  const [formState, setFormState] = useState(initialFormState);
  const [commitments, setCommitments] = useState<AccountingCommitmentWithDetails[]>([]);
  const [personnelFactors, setPersonnelFactors] = useState<Record<string, number>>({});
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [commitmentToView, setCommitmentToView] = useState<AccountingCommitmentWithDetails | null>(null);

  const fetchCommitments = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users?module=personnel&type=commitments`);
      if (!response.ok) throw new Error('Failed to fetch commitments');
      setCommitments(await response.json());
    } catch (error) {
      console.error(error);
      alert('خطا در بارگذاری اطلاعات پیشین تعهدات');
    }
  }, []);

  useEffect(() => { fetchCommitments(); }, [fetchCommitments]);

  const letterBody = useMemo(() => {
    const borrowerName = `${formState.borrower_first_name} ${formState.borrower_last_name}`.trim();
    const guarantorName = `${formState.guarantor_first_name} ${formState.guarantor_last_name}`.trim();
    return `احتراماً حسابداری این شرکت تعهد می نماید در صورت عدم پرداخت اقساط وام به مبلغ ${formState.amount ? formatRial(formState.amount) : '[مبلغ وام]'} ریال بنام آقای ${borrowerName || '[نام وام گیرنده]'} فرزند ${formState.borrower_father_name || '[نام پدر]'} با کد ملی ${formState.borrower_national_id ? toPersianDigits(formState.borrower_national_id) : '[کد ملی]'} از حقوق ضامن نامبرده آقای ${guarantorName || '[نام ضامن]'} در این شرکت شاغل باشد بعد از اعلام بانک و با رعایت سقف قانونی کسر و به حساب آن بانک واریز نماید.\n\nاین گواهی بنا به درخواست نامبرده جهت ارائه به بانک فوق صادر گردیده است و فاقد هرگونه ارزش دیگری می باشد.`;
  }, [formState]);

  const calculation = useMemo(() => {
    if (formState.personnel_id && formState.total_factors !== '' && formState.amount !== '') {
        const previousTotal = commitments
            .filter(c => c.personnel_id === formState.personnel_id && c.id !== formState.id)
            .reduce((sum, c) => sum + Number(c.amount), 0);
        const ceiling = Number(formState.total_factors) * 30;
        const effectiveCeiling = ceiling - previousTotal;
        const remaining = effectiveCeiling - Number(formState.amount);
        const isPermitted = Number(formState.amount) <= effectiveCeiling;
        return { ceiling, previousTotal, effectiveCeiling, remaining, isPermitted };
    }
    return null;
  }, [formState.personnel_id, formState.total_factors, formState.amount, formState.id, commitments]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumeric = ['amount', 'total_factors'].includes(name);
    
    setFormState(prev => ({
        ...prev,
        [name]: isNumeric ? (value === '' ? '' : parseInt(toEnglishDigits(value).replace(/,/g, ''), 10) || 0) : value
    }));
  };
  
  const handleSelectBorrower = (p: Personnel) => {
    setFormState(prev => ({
        ...prev,
        personnel_id: p.id,
        borrower_search: `${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})`,
        borrower_first_name: p.first_name,
        borrower_last_name: p.last_name,
        borrower_father_name: p.father_name,
        borrower_national_id: p.national_id,
        total_factors: personnelFactors[p.personnel_code] || '',
    }));
  };

  const handleBorrowerSearchChange = (val: string) => {
      setFormState(prev => ({ ...prev, borrower_search: val, personnel_id: null }));
  };
  
  const handleSelectGuarantor = (p: Personnel) => {
    setFormState(prev => ({
        ...prev,
        guarantor_search: `${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})`,
        guarantor_first_name: p.first_name,
        guarantor_last_name: p.last_name,
    }));
  };

  const resetForm = useCallback(() => setFormState(initialFormState), []);
  
  const handleEdit = useCallback((c: AccountingCommitmentWithDetails) => {
    const p = c.personnel_id ? personnelList.find(p => p.id === c.personnel_id) : null;
    setFormState({
        id: c.id,
        addressee: c.addressee,
        title: c.title,
        letter_date: c.letter_date,
        amount: c.amount,
        personnel_id: c.personnel_id,
        borrower_search: p ? `${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})` : '',
        borrower_first_name: c.personnel_first_name,
        borrower_last_name: c.personnel_last_name,
        borrower_father_name: p ? p.father_name : c.borrower_father_name || '',
        borrower_national_id: p ? p.national_id : c.borrower_national_id || '',
        guarantor_first_name: c.guarantor_first_name,
        guarantor_last_name: c.guarantor_last_name,
        guarantor_search: `${c.guarantor_first_name} ${c.guarantor_last_name}`,
        total_factors: p && personnelFactors[p.personnel_code] ? personnelFactors[p.personnel_code] : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [personnelList, personnelFactors]);

  const handleSave = async () => {
    if (!formState.addressee || !formState.title || !letterBody || !formState.borrower_first_name || !formState.borrower_last_name || !formState.guarantor_first_name || !formState.guarantor_last_name || !formState.letter_date || formState.amount === '') {
        alert('لطفاً تمام فیلدهای ستاره‌دار و اطلاعات وام گیرنده و ضامن را به طور کامل پر کنید.');
        return;
    }

    const { borrower_search, guarantor_search, total_factors, ...dataToSave } = formState;

    const payload = {
        ...dataToSave,
        body: letterBody,
        amount: Number(dataToSave.amount),
        borrower_first_name: !dataToSave.personnel_id ? dataToSave.borrower_first_name : undefined,
        borrower_last_name: !dataToSave.personnel_id ? dataToSave.borrower_last_name : undefined,
        borrower_father_name: !dataToSave.personnel_id ? dataToSave.borrower_father_name : undefined,
        borrower_national_id: !dataToSave.personnel_id ? dataToSave.borrower_national_id : undefined,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/users?module=personnel&type=commitments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to save');
        await fetchCommitments();
        alert(`نامه تعهد با موفقیت ${formState.id ? 'ویرایش' : 'ذخیره'} شد.`);
        resetForm();
    } catch(e) {
        alert(`خطا در ذخیره سازی: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const handlePreview = () => {
    const p = formState.personnel_id ? personnelList.find(p => p.id === formState.personnel_id) : null;
    const previewData: AccountingCommitmentWithDetails = {
        id: formState.id || 0,
        personnel_id: formState.personnel_id,
        addressee: formState.addressee,
        title: formState.title,
        letter_date: formState.letter_date,
        amount: Number(formState.amount) || 0,
        body: letterBody,
        created_at: new Date().toISOString(),
        guarantor_first_name: formState.guarantor_first_name,
        guarantor_last_name: formState.guarantor_last_name,
        personnel_first_name: formState.borrower_first_name,
        personnel_last_name: formState.borrower_last_name,
        personnel_code: p?.personnel_code || null,
        borrower_first_name: formState.borrower_first_name,
        borrower_last_name: formState.borrower_last_name,
        borrower_father_name: formState.borrower_father_name,
        borrower_national_id: formState.borrower_national_id,
    };
    setCommitmentToView(previewData);
    setIsViewModalOpen(true);
  };

  const handleFactorsImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            const factorsMap: Record<string, number> = {};
            json.forEach(row => {
                const code = row['کد پرسنلی'] ? String(row['کد پرسنلی']) : null;
                const amount = row['جمع عوامل حکمی'] ? Number(toEnglishDigits(String(row['جمع عوامل حکمی'])).replace(/,/g, '')) : null;
                if (code && amount !== null && !isNaN(amount)) factorsMap[code] = amount;
            });

            setPersonnelFactors(factorsMap);
            alert(`${toPersianDigits(Object.keys(factorsMap).length)} رکورد با موفقیت بارگذاری شد.`);
        } catch (error) {
            alert(`خطا در بارگذاری فایل: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsBinaryString(file);
  };
  
  const handleDeleteCommitment = async (id: number) => {
    if (window.confirm('آیا از حذف این نامه تعهد اطمینان دارید؟')) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users?module=personnel&type=commitments&id=${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete commitment');
            await fetchCommitments();
        } catch (error) {
            alert("خطا در حذف نامه!");
        }
    }
  };

  return (
    <div className="animate-fade-in-up space-y-8">
        {isViewModalOpen && <ViewLetterModal commitment={commitmentToView} onClose={() => setIsViewModalOpen(false)} />}
        
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800 mb-4 border-b pb-3">{formState.id ? `ویرایش نامه تعهد برای: ${formState.borrower_first_name} ${formState.borrower_last_name}` : 'ایجاد نامه تعهد جدید'}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
               <div>
                  <label htmlFor="addressee" className="block text-sm font-medium text-slate-700 mb-1">گیرنده نامه<span className="text-red-500 mr-1">*</span></label>
                  <input id="addressee" name="addressee" value={formState.addressee} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                </div>
                 <div>
                    <label htmlFor="total_factors" className="block text-sm font-medium text-slate-700 mb-1">جمع عوامل حکمی (ریال)<span className="text-red-500 mr-1">*</span></label>
                    <div className="flex items-center gap-2">
                        <input type="text" id="total_factors" name="total_factors" value={formState.total_factors === '' ? '' : formatRial(formState.total_factors)} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="برای محاسبه سقف تعهد" />
                        <div className="relative group">
                            <label title="ورود انبوه با اکسل" className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer transition">
                                <UploadIcon className="w-5 h-5" />
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFactorsImport} />
                            </label>
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white border rounded-lg shadow-xl p-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-opacity text-xs z-10">
                                <p className="text-slate-600 mb-2">برای ورود انبوه عوامل حکمی پرسنل از فایل اکسل استفاده کنید. (فرمت: کد پرسنلی، جمع عوامل حکمی)</p>
                                <button onClick={() => { const sampleHeaders = ['کد پرسنلی', 'جمع عوامل حکمی']; const ws = XLSX.utils.aoa_to_sheet([sampleHeaders]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Factors'); XLSX.writeFile(wb, 'نمونه_عوامل_حکمی.xlsx'); }} className="text-blue-600 hover:underline w-full text-right font-semibold">دانلود نمونه اکسل</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">مبلغ وام (ریال)<span className="text-red-500 mr-1">*</span></label>
                  <input type="text" id="amount" name="amount" value={formState.amount === '' ? '' : formatRial(formState.amount)} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">اطلاعات وام گیرنده</h3>
                <PersonnelSearch label="جستجوی وام گیرنده از پرسنل" placeholder="جستجو برای تکمیل خودکار..." personnelList={personnelList} onSelect={handleSelectBorrower} value={formState.borrower_search} onChange={handleBorrowerSearchChange} />
                <div className="flex items-center text-slate-500 my-2"><div className="flex-grow h-px bg-slate-200"></div><span className="mx-2 text-xs">یا</span><div className="flex-grow h-px bg-slate-200"></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <input name="borrower_first_name" value={formState.borrower_first_name} disabled={!!formState.personnel_id} onChange={handleInputChange} placeholder="نام*" className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"/>
                    <input name="borrower_last_name" value={formState.borrower_last_name} disabled={!!formState.personnel_id} onChange={handleInputChange} placeholder="نام خانوادگی*" className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"/>
                    <input name="borrower_father_name" value={formState.borrower_father_name} disabled={!!formState.personnel_id} onChange={handleInputChange} placeholder="نام پدر" className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"/>
                    <input name="borrower_national_id" value={formState.borrower_national_id} disabled={!!formState.personnel_id} onChange={handleInputChange} placeholder="کد ملی" className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"/>
                </div>
            </div>
            
            {calculation && (
              <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-2 text-sm">
                <h3 className="font-bold text-base text-blue-800">نتایج محاسبه سقف تعهد</h3>
                <div className="flex justify-between"><span>سقف تعهد مجاز (۳۰ برابر حکم):</span> <span className="font-semibold">{formatRial(calculation.ceiling)} ریال</span></div>
                <div className="flex justify-between"><span>مجموع تعهدات قبلی:</span> <span className="font-semibold text-orange-600">{formatRial(calculation.previousTotal)} ریال</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span className="font-bold">سقف تعهد موثر (پس از کسر تعهدات):</span><span className="font-bold text-lg">{formatRial(calculation.effectiveCeiling)} ریال</span></div>
                <div className="flex justify-between"><span>باقیمانده پس از وام فعلی:</span> <span className="font-semibold">{formatRial(calculation.remaining)} ریال</span></div>
                <div className={`flex justify-between items-center p-2 rounded-md mt-2 ${calculation.isPermitted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <span className="font-bold text-base">وضعیت:</span>
                    <span className="font-bold text-base">{calculation.isPermitted ? 'مجاز به دریافت تعهد' : 'غیر مجاز (مبلغ وام بیش از سقف است)'}</span>
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">اطلاعات ضامن</h3>
                 <PersonnelSearch label="جستجوی ضامن از پرسنل" placeholder="جستجو برای تکمیل خودکار..." personnelList={personnelList} onSelect={handleSelectGuarantor} value={formState.guarantor_search} onChange={(val) => setFormState(p => ({...p, guarantor_search: val}))} />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <input name="guarantor_first_name" value={formState.guarantor_first_name} onChange={handleInputChange} placeholder="نام ضامن*" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                    <input name="guarantor_last_name" value={formState.guarantor_last_name} onChange={handleInputChange} placeholder="نام خانوادگی ضامن*" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                 </div>
            </div>
            <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">متن نامه (پیش‌نمایش خودکار)</label>
                <textarea value={letterBody} readOnly rows={6} className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg shadow-sm leading-relaxed"/>
            </div>
            <div className="flex justify-end pt-6 mt-4 border-t border-slate-200 space-x-2 space-x-reverse">
                <button onClick={resetForm} className="px-5 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition font-medium">{formState.id ? 'لغو ویرایش' : 'پاک کردن فرم'}</button>
                <button onClick={handlePreview} className="px-5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium shadow-sm">نمایش و چاپ پیش‌نمایش</button>
                <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">{formState.id ? 'ذخیره تغییرات' : 'ذخیره در آرشیو'}</button>
            </div>
        </div>

        <div>
            <h2 className="text-2xl font-bold text-slate-700 mb-4">آرشیو نامه‌های تعهد</h2>
            <CommitmentArchive 
                commitments={commitments} 
                onView={(c) => { setCommitmentToView(c); setIsViewModalOpen(true); }} 
                onEdit={handleEdit} 
                onDelete={handleDeleteCommitment} 
            />
        </div>
    </div>
  );
};