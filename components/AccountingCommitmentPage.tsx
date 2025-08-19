import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Personnel, AccountingCommitmentWithDetails } from '../types';
import { toPersianDigits, formatRial, toEnglishDigits } from './format';
import { CloseIcon, UploadIcon } from './icons';
import * as XLSX from 'xlsx';


interface AccountingCommitmentPageProps {
  personnelList: Personnel[];
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

// --- Footer Icons for Printable Letter ---
const PhoneIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>);
const GlobeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0012 16.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m0 0A11.953 11.953 0 0112 13.5c2.998 0 5.74 1.1 7.843 2.918" /></svg>);
const MailIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>);
const LocationIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>);


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
      const printWindow = window.open('', '', 'height=842,width=595'); // A5 dimensions in pixels approx
      if (printWindow) {
        printWindow.document.write('<html><head><title>چاپ نامه تعهد</title>');
        // We inject Tailwind's CDN and custom print styles for the letterhead
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"><\/script>');
        printWindow.document.write(`
          <style>
            @import url("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap");
            @page { size: A5; margin: 0; }
            body { 
              font-family: "Vazirmatn", sans-serif; 
              direction: rtl; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
              background-color: white;
            }
          </style>
        `);
        printWindow.document.write('</head><body class="bg-white">');
        printWindow.document.write(content.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        setTimeout(() => { // Timeout to allow styles and fonts to load
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 500);
      }
    }
  };

  const PrintableLetter = React.forwardRef<HTMLDivElement, { commitment: AccountingCommitmentWithDetails }>(({ commitment }, ref) => (
      <div ref={ref} className="w-[148mm] h-[210mm] bg-white relative p-6 mx-auto flex flex-col font-['Vazirmatn'] text-black overflow-hidden">
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 relative animate-fade-in-down max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h2 className="text-xl font-bold text-slate-800">نمایش نامه تعهد</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
                <CloseIcon />
            </button>
        </div>
        <div className="overflow-auto flex-1 bg-slate-100 p-4 rounded-md">
           <PrintableLetter ref={printableRef} commitment={commitment} />
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
  const [date, setDate] = useState(new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'));
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
  
  // States for view modal
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [commitmentToView, setCommitmentToView] = useState<AccountingCommitmentWithDetails | null>(null);
  
  const fetchCommitments = async () => {
    try {
        const response = await fetch('/api/commitments');
        if (!response.ok) throw new Error('Failed to fetch commitments');
        const data = await response.json();
        setCommitments(data);
    } catch (error) {
        console.error(error);
        alert('خطا در بارگذاری اطلاعات پیشین تعهدات');
    }
  };

  useEffect(() => { fetchCommitments(); }, []);

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
    setSelectedPersonnel(null);
    setBorrowerSearch('');
    setBorrowerDetails({ first_name: '', last_name: '', father_name: '', national_id: '' });
    setGuarantor({ first_name: '', last_name: '' });
    setGuarantorSearch('');
    setAmount('');
    setTotalFactors('');
    setAddressee('ریاست محترم بانک رفاه شعبه مرکزی سیرجان');
    setTitle('تعهد حسابداری');
    setDate(new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-'));
    setLetterBody('');
  };

  const handleSave = async () => {
    if (!addressee || !title || !letterBody || 
        (!selectedPersonnel && (!borrowerDetails.first_name || !borrowerDetails.last_name)) || 
        (!guarantor.first_name || !guarantor.last_name) || 
        !date || amount === '') {
        alert('لطفاً تمام فیلدهای ستاره‌دار و اطلاعات وام گیرنده و ضامن را به طور کامل پر کنید.');
        return;
    }
    
    const commitmentData = {
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
        alert(`نامه تعهد با موفقیت ذخیره شد.`);
        resetForm();
    } catch(e) {
        alert(`خطا در ذخیره سازی: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const closeViewModal = useCallback(() => {
    setIsViewModalOpen(false);
    setCommitmentToView(null);
  }, []);

  const handlePreview = () => {
    const previewData: AccountingCommitmentWithDetails = {
        id: 0,
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
        {isViewModalOpen && <ViewLetterModal commitment={commitmentToView} onClose={closeViewModal} />}
        <h1 className="text-3xl font-bold text-slate-700 mb-6">نامه تعهد حسابداری</h1>
        
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200 mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-3">ایجاد نامه جدید</h2>
            
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
                <button onClick={resetForm} className="px-5 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition font-medium">پاک کردن فرم</button>
                <button onClick={handlePreview} className="px-5 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium shadow-sm">نمایش و چاپ پیش‌نمایش</button>
                <button onClick={handleSave} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">ذخیره در آرشیو</button>
            </div>
        </div>
    </div>
  );
};