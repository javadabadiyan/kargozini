import React, { useState, useRef, useEffect } from 'react';
import type { Personnel, AccountingCommitmentWithDetails } from '../types';
import { toPersianDigits, formatRial, toEnglishDigits } from './format';
import { DeleteIcon, EditIcon, EyeIcon, CloseIcon, UploadIcon, ChevronDownIcon } from './icons';
import * as XLSX from 'xlsx';


interface AccountingCommitmentPageProps {
  personnelList: Personnel[];
}

interface GroupedCommitment {
  key: string;
  borrowerName: string;
  borrowerIdentifier: string;
  totalAmount: number;
  count: number;
  letters: AccountingCommitmentWithDetails[];
}

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

  const filteredPersonnel = personnelList.filter(p => {
    if (!value) return false;
    const searchTerm = value.toLowerCase();
    return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm) ||
        p.personnel_code.toLowerCase().includes(searchTerm)
    );
  });

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

const ViewLetterModal = ({
  commitment,
  onClose,
}: {
  commitment: AccountingCommitmentWithDetails | null;
  onClose: () => void;
}) => {
  if (!commitment) return null;

  const printableRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = () => {
    const content = printableRef.current;
    if (content) {
      const printWindow = window.open('', '', 'height=800,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>چاپ نامه</title>');
        printWindow.document.write('<style>@import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap"); body { font-family: "Vazirmatn", sans-serif; direction: rtl; padding: 20px; } .content { white-space: pre-line; line-height: 2; text-align: justify; } .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3rem; } .title { text-align: center; margin-bottom: 3rem; } .signature { margin-top: 6rem; text-align: center; } </style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(content.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 relative animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800">نمایش نامه تعهد</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
                <CloseIcon />
            </button>
        </div>
        <div className="overflow-y-auto flex-1" ref={printableRef}>
           <div className="header">
             <div className="text-sm">تاریخ: {toPersianDigits(commitment.letter_date)}</div>
             <div className="text-sm">شماره: .................</div>
           </div>
           <h1 className="title text-2xl font-bold">{commitment.addressee}</h1>
           <h2 className="title text-xl">موضوع: {commitment.title}</h2>
           <p className="content">{commitment.body}</p>
           <div className="signature">
             <p>با تشکر</p>
             <p className="font-bold">مدیریت سرمایه انسانی</p>
           </div>
        </div>
        <div className="flex justify-end pt-4 mt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 transition ml-2">بستن</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">چاپ</button>
        </div>
      </div>
    </div>
  );
};


export const AccountingCommitmentPage: React.FC<AccountingCommitmentPageProps> = ({ personnelList }) => {
  const [addressee, setAddressee] = useState('ریاست محترم بانک رفاه شعبه مرکزی سیرجان');
  const [title, setTitle] = useState('تعهد حسابداری');
  const [letterBody, setLetterBody] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }));
  const [amount, setAmount] = useState<number | ''>('');
  const [totalFactors, setTotalFactors] = useState<number | ''>('');
  const [personnelFactors, setPersonnelFactors] = useState<Record<string, number>>({});
  
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [borrowerDetails, setBorrowerDetails] = useState({
      first_name: '', last_name: '', father_name: '', national_id: ''
  });

  const [guarantorSearch, setGuarantorSearch] = useState('');
  const [guarantor, setGuarantor] = useState({
      first_name: '', last_name: ''
  });

  const [calculation, setCalculation] = useState<{
      ceiling: number; previousTotal: number; effectiveCeiling: number;
      remaining: number; isPermitted: boolean;
  } | null>(null);

  const [commitments, setCommitments] = useState<AccountingCommitmentWithDetails[]>([]);
  const [groupedCommitments, setGroupedCommitments] = useState<GroupedCommitment[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // States for edit and view modal
  const [editingCommitmentId, setEditingCommitmentId] = useState<number | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [commitmentToView, setCommitmentToView] = useState<AccountingCommitmentWithDetails | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
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

  useEffect(() => { fetchCommitments(); }, []);

  useEffect(() => {
    const groupData = (commitmentsToGroup: AccountingCommitmentWithDetails[]): GroupedCommitment[] => {
        const groups: { [key: string]: GroupedCommitment } = {};

        for (const c of commitmentsToGroup) {
            const key = c.personnel_id 
                ? `p-${c.personnel_id}` 
                : `m-${c.borrower_national_id || `${c.borrower_first_name}-${c.borrower_last_name}`}`;

            if (!groups[key]) {
                groups[key] = {
                    key,
                    borrowerName: `${c.personnel_first_name} ${c.personnel_last_name}`,
                    borrowerIdentifier: c.personnel_code || c.borrower_national_id || '',
                    totalAmount: 0,
                    count: 0,
                    letters: [],
                };
            }
            groups[key].totalAmount += c.amount;
            groups[key].count++;
            groups[key].letters.push(c);
        }
        return Object.values(groups).sort((a, b) => 
            new Date(b.letters[0].created_at).getTime() - new Date(a.letters[0].created_at).getTime()
        );
    };
    
    const query = searchQuery.toLowerCase();
    const filtered = commitments.filter(c =>
         `${c.personnel_first_name} ${c.personnel_last_name}`.toLowerCase().includes(query) ||
         (c.personnel_code && c.personnel_code.toLowerCase().includes(query)) ||
         (c.borrower_national_id && c.borrower_national_id.includes(query)) ||
         `${c.guarantor_first_name} ${c.guarantor_last_name}`.toLowerCase().includes(query) ||
         toPersianDigits(c.letter_date).toLowerCase().includes(query)
    );
    
    setGroupedCommitments(groupData(filtered));
  }, [searchQuery, commitments]);

  useEffect(() => {
    if (selectedPersonnel) {
        setBorrowerDetails({
            first_name: selectedPersonnel.first_name,
            last_name: selectedPersonnel.last_name,
            father_name: selectedPersonnel.father_name || '',
            national_id: selectedPersonnel.national_id || '',
        });
    }
  }, [selectedPersonnel]);
  
  const generateLetterBody = () => {
      const template = `احتراماً حسابداری این شرکت تعهد می نماید در صورت عدم پرداخت اقساط وام به مبلغ ${amount ? formatRial(amount) : '[مبلغ وام]'} ریال بنام آقای ${borrowerDetails.first_name || borrowerDetails.last_name ? `${borrowerDetails.first_name} ${borrowerDetails.last_name}` : '[نام وام گیرنده]'} فرزند ${borrowerDetails.father_name || '[نام پدر]'} با کد ملی ${borrowerDetails.national_id ? toPersianDigits(borrowerDetails.national_id) : '[کد ملی]'} از حقوق ضامن نامبرده آقای ${guarantor.first_name || guarantor.last_name ? `${guarantor.first_name} ${guarantor.last_name}` : '[نام ضامن]'} در این شرکت شاغل باشد بعد از اعلام بانک و با رعایت سقف قانونی کسر و به حساب آن بانک واریز نماید.\n\nاین گواهی بنا به درخواست نامبرده جهت ارائه به بانک فوق صادر گردیده است و فاقد هرگونه ارزش دیگری می باشد.`;
      setLetterBody(template);
  };
  
  useEffect(generateLetterBody, [borrowerDetails, guarantor, amount]);

  useEffect(() => {
    if (selectedPersonnel && totalFactors !== '' && amount !== '') {
        const previousTotal = commitments
            .filter(c => c.personnel_id === selectedPersonnel.id && c.id !== editingCommitmentId)
            .reduce((sum, c) => sum + Number(c.amount), 0);
        
        const ceiling = Number(totalFactors) * 30;
        const effectiveCeiling = ceiling - previousTotal;
        const remaining = effectiveCeiling - Number(amount);
        const isPermitted = Number(amount) <= effectiveCeiling;

        setCalculation({ ceiling, previousTotal, effectiveCeiling, remaining, isPermitted });
    } else {
        setCalculation(null);
    }
  }, [selectedPersonnel, totalFactors, amount, commitments, editingCommitmentId]);
  
  const handleSelectBorrower = (p: Personnel) => {
    setSelectedPersonnel(p);
    setBorrowerSearch(`${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})`);
    const factor = personnelFactors[p.personnel_code];
    if (factor) {
        setTotalFactors(factor);
    } else {
        setTotalFactors('');
    }
  };
  
  const handleBorrowerSearchChange = (val: string) => {
      setBorrowerSearch(val);
      if(selectedPersonnel) setSelectedPersonnel(null);
  };

  const handleBorrowerDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if(selectedPersonnel) {
        setSelectedPersonnel(null);
        setBorrowerSearch('');
    }
    setBorrowerDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGuarantorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGuarantor(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectGuarantor = (p: Personnel) => {
    setGuarantor({
        first_name: p.first_name, last_name: p.last_name,
    });
    setGuarantorSearch(`${p.first_name} ${p.last_name}`);
  };
  
  const resetForm = () => {
    setEditingCommitmentId(null);
    setSelectedPersonnel(null);
    setBorrowerSearch('');
    setBorrowerDetails({ first_name: '', last_name: '', father_name: '', national_id: '' });
    setGuarantor({ first_name: '', last_name: '' });
    setGuarantorSearch('');
    setAmount('');
    setTotalFactors('');
    setAddressee('ریاست محترم بانک رفاه شعبه مرکزی سیرجان');
    setTitle('تعهد حسابداری');
    setDate(new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }));
  };

  const handleSave = async () => {
    if (!addressee || !title || !letterBody || !borrowerDetails.first_name || !guarantor.first_name || !date || !amount) {
        alert('لطفاً تمام فیلدهای ستاره‌دار را پر کنید.');
        return;
    }
    
    const commitmentData = {
        id: editingCommitmentId,
        title, body: letterBody, letter_date: date,
        amount: Number(amount),
        addressee,
        personnel_id: selectedPersonnel ? selectedPersonnel.id : null,
        guarantor_first_name: guarantor.first_name,
        guarantor_last_name: guarantor.last_name,
        borrower_first_name: !selectedPersonnel ? borrowerDetails.first_name : undefined,
        borrower_last_name: !selectedPersonnel ? borrowerDetails.last_name : undefined,
        borrower_father_name: !selectedPersonnel ? borrowerDetails.father_name : undefined,
        borrower_national_id: !selectedPersonnel ? borrowerDetails.national_id : undefined,
    };

    try {
        const response = await fetch('/api/commitments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commitmentData),
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Failed to save');
        await fetchCommitments();
        alert(`نامه تعهد با موفقیت ${editingCommitmentId ? 'ویرایش' : 'ذخیره'} شد.`);
        resetForm();
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

  const handleView = (commitment: AccountingCommitmentWithDetails) => {
    setCommitmentToView(commitment);
    setIsViewModalOpen(true);
  };

  const handleEdit = (commitment: AccountingCommitmentWithDetails) => {
    setEditingCommitmentId(commitment.id);
    setAddressee(commitment.addressee);
    setTitle(commitment.title);
    setDate(commitment.letter_date);
    setAmount(commitment.amount);
    
    if (commitment.personnel_id) {
        const p = personnelList.find(p => p.id === commitment.personnel_id);
        if (p) {
            setSelectedPersonnel(p);
            setBorrowerSearch(`${p.first_name} ${p.last_name} (${toPersianDigits(p.personnel_code)})`);
        }
    } else {
        setSelectedPersonnel(null);
        setBorrowerSearch('');
        setBorrowerDetails({
            first_name: commitment.borrower_first_name || '',
            last_name: commitment.borrower_last_name || '',
            father_name: commitment.borrower_father_name || '',
            national_id: commitment.borrower_national_id || '',
        });
    }

    setGuarantor({
        first_name: commitment.guarantor_first_name,
        last_name: commitment.guarantor_last_name,
    });
    setGuarantorSearch(`${commitment.guarantor_first_name} ${commitment.guarantor_last_name}`);
        
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handlePreview = () => {
    const previewData: AccountingCommitmentWithDetails = {
        id: editingCommitmentId || 0,
        personnel_id: selectedPersonnel?.id || null,
        addressee, title,
        letter_date: date,
        amount: Number(amount) || 0,
        body: letterBody,
        created_at: new Date().toISOString(),
        guarantor_first_name: guarantor.first_name,
        guarantor_last_name: guarantor.last_name,
        personnel_first_name: borrowerDetails.first_name,
        personnel_last_name: borrowerDetails.last_name,
        personnel_code: selectedPersonnel?.personnel_code || null,
        borrower_first_name: borrowerDetails.first_name,
        borrower_last_name: borrowerDetails.last_name,
        borrower_father_name: borrowerDetails.father_name,
        borrower_national_id: borrowerDetails.national_id,
    };
    setCommitmentToView(previewData);
    setIsViewModalOpen(true);
  };
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const englishValue = toEnglishDigits(e.target.value);
    const numericValue = parseInt(englishValue.replace(/,/g, ''), 10);
    setAmount(isNaN(numericValue) ? '' : numericValue);
  };

  const handleTotalFactorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const englishValue = toEnglishDigits(e.target.value);
    const numericValue = parseInt(englishValue.replace(/,/g, ''), 10);
    setTotalFactors(isNaN(numericValue) ? '' : numericValue);
  };

  const handleDownloadFactorsSample = () => {
    const headers = ['کد پرسنلی', 'جمع عوامل حکمی'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Factors');
    XLSX.writeFile(wb, 'نمونه_عوامل_حکمی.xlsx');
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

            if (json.length === 0) {
                alert('فایل اکسل خالی است.');
                return;
            }

            const factorsMap: Record<string, number> = {};
            let processedCount = 0;
            json.forEach(row => {
                const personnelCode = row['کد پرسنلی'] ? String(row['کد پرسنلی']) : null;
                const factorAmount = row['جمع عوامل حکمی'] ? Number(toEnglishDigits(String(row['جمع عوامل حکمی'])).replace(/,/g, '')) : null;

                if (personnelCode && factorAmount !== null && !isNaN(factorAmount)) {
                    factorsMap[personnelCode] = factorAmount;
                    processedCount++;
                }
            });

            setPersonnelFactors(factorsMap);
            alert(`${toPersianDigits(processedCount)} رکورد با موفقیت بارگذاری شد.`);

        } catch (error) {
            alert(`خطا در بارگذاری فایل: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsBinaryString(file);
  };

  const renderCalculation = () => {
      if (!selectedPersonnel) {
          return (
            <div className="mt-4 p-4 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-600">
                برای محاسبه سقف تعهد، وام گیرنده را از لیست پرسنل موجود انتخاب نمایید.
            </div>
          );
      }
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
        <ViewLetterModal commitment={commitmentToView} onClose={() => setIsViewModalOpen(false)} />
        <h1 className="text-3xl font-bold text-slate-700 mb-6">نامه تعهد حسابداری</h1>
        
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8" ref={formRef}>
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">{editingCommitmentId ? 'ویرایش نامه' : 'ایجاد نامه جدید'}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
               <div>
                  <label htmlFor="addressee" className="block text-sm font-medium text-slate-700 mb-1">گیرنده نامه<span className="text-red-500 mr-1">*</span></label>
                  <input id="addressee" value={addressee} onChange={(e) => setAddressee(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                </div>
                 <div>
                    <label htmlFor="total_factors" className="block text-sm font-medium text-slate-700 mb-1">جمع عوامل حکمی (ریال)<span className="text-red-500 mr-1">*</span></label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            id="total_factors" 
                            value={totalFactors === '' ? '' : formatRial(totalFactors)} 
                            onChange={handleTotalFactorsChange} 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg" 
                            placeholder="برای محاسبه سقف تعهد"
                        />
                        <div className="relative group">
                            <label title="ورود انبوه با اکسل" className="p-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 cursor-pointer transition">
                                <UploadIcon className="w-5 h-5" />
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFactorsImport} />
                            </label>
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white border rounded-lg shadow-xl p-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-opacity text-xs z-10">
                                <p className="text-slate-600 mb-2">برای ورود انبوه عوامل حکمی پرسنل از فایل اکسل استفاده کنید. (فرمت: کد پرسنلی، جمع عوامل حکمی)</p>
                                <button onClick={handleDownloadFactorsSample} className="text-blue-600 hover:underline w-full text-right font-semibold">دانلود نمونه اکسل</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-slate-700 mb-1">مبلغ وام (ریال)<span className="text-red-500 mr-1">*</span></label>
                  <input type="text" id="amount" value={amount === '' ? '' : formatRial(amount)} onChange={handleAmountChange} className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">اطلاعات وام گیرنده</h3>
                <PersonnelSearch label="جستجوی وام گیرنده از پرسنل (اختیاری)" placeholder="جستجو برای تکمیل خودکار..." personnelList={personnelList} onSelect={handleSelectBorrower} value={borrowerSearch} onChange={handleBorrowerSearchChange} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <input name="first_name" value={borrowerDetails.first_name} onChange={handleBorrowerDetailsChange} placeholder="نام*" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                    <input name="last_name" value={borrowerDetails.last_name} onChange={handleBorrowerDetailsChange} placeholder="نام خانوادگی*" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                    <input name="father_name" value={borrowerDetails.father_name} onChange={handleBorrowerDetailsChange} placeholder="نام پدر" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                    <input name="national_id" value={borrowerDetails.national_id} onChange={handleBorrowerDetailsChange} placeholder="کد ملی" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                </div>
            </div>
            
            {renderCalculation()}
            
            <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold text-slate-800 mb-3">اطلاعات ضامن</h3>
                 <PersonnelSearch label="جستجوی ضامن از پرسنل (اختیاری)" placeholder="جستجو برای تکمیل خودکار..." personnelList={personnelList} onSelect={handleSelectGuarantor} value={guarantorSearch} onChange={setGuarantorSearch} />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <input name="first_name" value={guarantor.first_name} onChange={handleGuarantorChange} placeholder="نام ضامن*" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                    <input name="last_name" value={guarantor.last_name} onChange={handleGuarantorChange} placeholder="نام خانوادگی ضامن*" className="w-full px-3 py-2 border border-slate-300 rounded-lg"/>
                 </div>
            </div>
            <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">متن نامه (پیش‌نمایش خودکار)</label>
                <textarea value={letterBody} readOnly rows={8} className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg shadow-sm leading-relaxed"/>
            </div>
            <div className="flex justify-end pt-6 mt-4 border-t border-slate-200 space-x-2 space-x-reverse">
                {editingCommitmentId && (
                  <button onClick={resetForm} className="px-5 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition font-medium">لغو ویرایش</button>
                )}
                <button onClick={handlePreview} className="px-5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium shadow-sm">نمایش و چاپ پیش‌نمایش</button>
                <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">{editingCommitmentId ? 'ذخیره تغییرات' : 'ذخیره در آرشیو'}</button>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">آرشیو نامه‌های ذخیره شده</h2>
            <input type="text" placeholder="جستجو در آرشیو..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-1/3 mb-4 px-4 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
             <div className="space-y-3">
                {isLoading ? (
                    <div className="text-center py-8 text-slate-500">در حال بارگذاری...</div>
                ) : groupedCommitments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">هیچ نامه‌ای یافت نشد.</div>
                ) : (
                    groupedCommitments.map(group => (
                        <div key={group.key} className="border border-slate-200 rounded-lg overflow-hidden transition-all duration-300">
                            <button 
                                className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 hover:bg-slate-100 transition text-right"
                                onClick={() => setExpandedKey(expandedKey === group.key ? null : group.key)}
                                aria-expanded={expandedKey === group.key}
                            >
                                <div className="mb-2 sm:mb-0">
                                    <p className="font-bold text-slate-800">{group.borrowerName}</p>
                                    <p className="text-sm text-slate-500">{group.borrowerIdentifier ? `کد: ${toPersianDigits(group.borrowerIdentifier)}` : ''}</p>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse text-sm w-full sm:w-auto justify-end">
                                    <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded-md font-medium">تعداد: {toPersianDigits(group.count)}</span>
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md font-semibold">مجموع: {formatRial(group.totalAmount)} ریال</span>
                                    <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${expandedKey === group.key ? 'rotate-180' : ''}`} />
                                </div>
                            </button>
                            {expandedKey === group.key && (
                                <div className="p-2 bg-white animate-fade-in-down">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">ضامن</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">مبلغ</th>
                                                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">تاریخ</th>
                                                    <th className="relative px-4 py-2"><span className="sr-only">عملیات</span></th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-slate-100">
                                                {group.letters.map(c => (
                                                    <tr key={c.id}>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{c.guarantor_first_name} {c.guarantor_last_name}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{formatRial(c.amount)}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{toPersianDigits(c.letter_date)}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-left text-sm font-medium">
                                                            <div className="flex items-center justify-end space-x-4 space-x-reverse">
                                                                <button onClick={() => handleView(c)} className="text-slate-500 hover:text-blue-600 transition" title="نمایش نامه"><EyeIcon className="w-5 h-5"/></button>
                                                                <button onClick={() => handleEdit(c)} className="text-slate-500 hover:text-indigo-600 transition" title="ویرایش"><EditIcon className="w-5 h-5"/></button>
                                                                <button onClick={() => handleDelete(c.id)} className="text-slate-500 hover:text-red-600 transition" title="حذف"><DeleteIcon className="w-5 h-5"/></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
             </div>
        </div>
    </div>
  );
};