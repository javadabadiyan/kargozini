import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Personnel, CommitmentLetter } from '../../types';
import { SearchIcon, PrinterIcon, RefreshIcon, DocumentReportIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, DocumentIcon } from '../icons/Icons';
import EditCommitmentLetterModal from '../EditCommitmentLetterModal';


const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
              .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '۰';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};


const AccountingCommitmentPage: React.FC = () => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuarantor, setSelectedGuarantor] = useState<Personnel | null>(null);

    const [recipientName, setRecipientName] = useState('');
    const [recipientNationalId, setRecipientNationalId] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [branchName, setBranchName] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [decreeFactors, setDecreeFactors] = useState('');
    
    const [totalCommitted, setTotalCommitted] = useState(0);
    const [loadingCommitment, setLoadingCommitment] = useState(false);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    
    const [archivedLetters, setArchivedLetters] = useState<CommitmentLetter[]>([]);
    const [archiveLoading, setArchiveLoading] = useState(true);
    const [archiveError, setArchiveError] = useState<string | null>(null);
    const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
    const [expandedGuarantors, setExpandedGuarantors] = useState<Set<string>>(new Set());

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLetter, setEditingLetter] = useState<CommitmentLetter | null>(null);
    const [isPrintingArchived, setIsPrintingArchived] = useState(false);

    const [archiveCurrentPage, setArchiveCurrentPage] = useState(1);
    const ARCHIVE_PAGE_SIZE = 10;
    
    // State for layout adjustment
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragInfo = useRef<{ isDragging: boolean; startX: number; startY: number; initialX: number; initialY: number; }>({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    const printRef = useRef<HTMLDivElement>(null);

    // Load/Save layout position
    useEffect(() => {
        const savedPosition = localStorage.getItem('commitmentLetterPosition');
        if (savedPosition) {
            setPosition(JSON.parse(savedPosition));
        }
    }, []);

    const handleSavePosition = () => {
        localStorage.setItem('commitmentLetterPosition', JSON.stringify(position));
        setStatus({ type: 'success', message: 'موقعیت جدید نامه ذخیره شد.' });
        setIsAdjusting(false);
        setTimeout(() => setStatus(null), 3000);
    };

    const handleResetPosition = () => {
        localStorage.removeItem('commitmentLetterPosition');
        setPosition({ x: 0, y: 0 });
        setStatus({ type: 'info', message: 'موقعیت به حالت پیش‌فرض بازگشت.' });
        setTimeout(() => setStatus(null), 3000);
    };

    const fetchArchivedLetters = useCallback(async (searchQuery = '') => {
        setArchiveLoading(true);
        setArchiveError(null);
        try {
            const response = await fetch(`/api/personnel?type=commitment_letters&searchTerm=${encodeURIComponent(searchQuery)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در دریافت بایگانی نامه‌ها');
            }
            const data = await response.json();
            setArchivedLetters(data.letters || []);
        } catch (err) {
            setArchiveError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
        } finally {
            setArchiveLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                setPersonnelLoading(true);
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('خطا در دریافت لیست پرسنل');
                const data = await response.json();
                setPersonnelList(data.personnel || []);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد' });
            } finally {
                setPersonnelLoading(false);
            }
        };
        fetchPersonnel();
        fetchArchivedLetters();
    }, [fetchArchivedLetters]);

    useEffect(() => {
        if (!selectedGuarantor) {
            setTotalCommitted(0);
            return;
        }
        const fetchCommitment = async () => {
            setLoadingCommitment(true);
            try {
                const response = await fetch(`/api/personnel?type=commitment_letters&guarantorCode=${selectedGuarantor.personnel_code}`);
                if (!response.ok) throw new Error('خطا در دریافت تعهدات ضامن');
                const data = await response.json();
                setTotalCommitted(data.totalCommitted || 0);
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطای ناشناخته' });
            } finally {
                setLoadingCommitment(false);
            }
        };
        fetchCommitment();
    }, [selectedGuarantor]);

    const handlePrint = useCallback(() => {
        const printContent = printRef.current?.innerHTML;
        if (printContent) {
            const printWindow = window.open('', '', 'height=800,width=800');
            if (printWindow) {
                printWindow.document.write('<html><head><title>چاپ نامه تعهد</title>');
                printWindow.document.write('<link rel="preconnect" href="https://fonts.googleapis.com">');
                printWindow.document.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
                printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">');
                printWindow.document.write('<style> body { font-family: "Amiri", serif; direction: rtl; line-height: 2.5; padding: 20px; font-size: 16px; margin: 0; } .content-wrapper { position: relative; } .signature { margin-top: 100px; text-align: left; } .underline { border-bottom: 1px dotted black; padding: 0 5px; font-weight: bold; } </style>');
                printWindow.document.write('</head><body>');
                const styledContent = `<div class="content-wrapper" style="top: ${position.y}px; left: ${position.x}px;">${printContent}</div>`;
                printWindow.document.write(styledContent);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                // Delay print to allow fonts to load
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        }
    }, [position]);

    useEffect(() => {
        if (isPrintingArchived) {
            handlePrint();
            setIsPrintingArchived(false);
        }
    }, [isPrintingArchived, handlePrint]);

    const filteredPersonnel = useMemo(() => {
        const lowercasedTerm = searchTerm.toLowerCase().trim();
        if (!lowercasedTerm) return [];
        return personnelList.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
            p.personnel_code.toLowerCase().includes(lowercasedTerm)
        ).slice(0, 10);
    }, [personnelList, searchTerm]);

    const handleSelectGuarantor = (person: Personnel) => {
        setSelectedGuarantor(person);
        setSearchTerm('');
        setDecreeFactors(toEnglishDigits(String(person.sum_of_decree_factors || '0')).replace(/,/g, ''));
    };
    
    const handleRefreshDecreeFactors = useCallback(() => {
        if (selectedGuarantor) {
            setDecreeFactors(toEnglishDigits(String(selectedGuarantor.sum_of_decree_factors || '0')).replace(/,/g, ''));
        }
    }, [selectedGuarantor]);

    const resetForm = () => {
        setRecipientName('');
        setRecipientNationalId('');
        setLoanAmount('');
        setBankName('');
        setBranchName('');
        setReferenceNumber('');
    };
    
    const handleClearGuarantor = () => {
        setSelectedGuarantor(null);
        setSearchTerm('');
        setDecreeFactors('');
        resetForm();
    };
    
    const handleSaveAndPrint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGuarantor) {
            setStatus({ type: 'error', message: 'لطفا ابتدا یک ضامن را انتخاب کنید.' });
            return;
        }
        setStatus({ type: 'info', message: 'در حال ذخیره نامه تعهد...'});
        try {
            const payload = {
                recipient_name: recipientName,
                recipient_national_id: recipientNationalId,
                guarantor_personnel_code: selectedGuarantor.personnel_code,
                guarantor_name: `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}`,
                guarantor_national_id: selectedGuarantor.national_id,
                loan_amount: Number(loanAmount || '0'),
                sum_of_decree_factors: Number(decreeFactors || '0'),
                bank_name: bankName,
                branch_name: branchName,
                reference_number: referenceNumber,
            };
            const response = await fetch('/api/personnel?type=commitment_letters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setStatus({ type: 'success', message: 'نامه تعهد با موفقیت ذخیره شد. در حال آماده سازی چاپ...'});
            handlePrint();

             const newCommitmentResponse = await fetch(`/api/personnel?type=commitment_letters&guarantorCode=${selectedGuarantor.personnel_code}`);
             const newCommitmentData = await newCommitmentResponse.json();
             setTotalCommitted(newCommitmentData.totalCommitted || 0);
             fetchArchivedLetters(archiveSearchTerm);
             resetForm();

        } catch(err) {
             setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره نامه' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleArchiveSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setArchiveCurrentPage(1);
        fetchArchivedLetters(archiveSearchTerm);
    };
    
    const handleDeleteLetter = async (id: number) => {
        if (window.confirm('آیا از حذف این نامه از بایگانی اطمینان دارید؟ این عمل قابل بازگشت نیست.')) {
            setStatus({ type: 'info', message: 'در حال حذف نامه...'});
            try {
                const response = await fetch(`/api/personnel?type=commitment_letters&id=${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: 'نامه با موفقیت حذف شد.' });
                fetchArchivedLetters(archiveSearchTerm);
                if (selectedGuarantor) {
                    const commitmentResponse = await fetch(`/api/personnel?type=commitment_letters&guarantorCode=${selectedGuarantor.personnel_code}`);
                    const commitmentData = await commitmentResponse.json();
                    setTotalCommitted(commitmentData.totalCommitted || 0);
                }
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف نامه' });
            } finally {
                setTimeout(() => setStatus(null), 4000);
            }
        }
    };
    
    const handleEditClick = (letter: CommitmentLetter) => {
        setEditingLetter(letter);
        setIsEditModalOpen(true);
    };

    const handleSaveLetter = async (letter: CommitmentLetter) => {
        setStatus({ type: 'info', message: 'در حال ویرایش نامه...' });
        try {
            const response = await fetch('/api/personnel?type=commitment_letters', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(letter)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: 'نامه با موفقیت ویرایش شد.' });
            setIsEditModalOpen(false);
            setEditingLetter(null);
            fetchArchivedLetters(archiveSearchTerm);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ویرایش نامه' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };
    
    const handleShowArchivedLetter = (letter: CommitmentLetter) => {
        const guarantor = personnelList.find(p => p.personnel_code === letter.guarantor_personnel_code);
    
        if (guarantor) {
            setSelectedGuarantor(guarantor);
        } else {
            const archivedGuarantorData: Partial<Personnel> = {
                personnel_code: letter.guarantor_personnel_code,
                first_name: letter.guarantor_name.split(' ')[0] || '',
                last_name: letter.guarantor_name.split(' ').slice(1).join(' ') || '',
                national_id: letter.guarantor_national_id,
                sum_of_decree_factors: String(letter.sum_of_decree_factors)
            };
            setSelectedGuarantor(archivedGuarantorData as Personnel);
        }
        
        setRecipientName(letter.recipient_name);
        setRecipientNationalId(letter.recipient_national_id);
        setLoanAmount(String(letter.loan_amount));
        setBankName(letter.bank_name || '');
        setBranchName(letter.branch_name || '');
        setReferenceNumber(letter.reference_number || '');
        setDecreeFactors(String(letter.sum_of_decree_factors || '0'));
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStatus({ type: 'info', message: `اطلاعات نامه شماره ${toPersianDigits(letter.id)} در فرم بالا نمایش داده شد.` });
        setTimeout(() => setStatus(null), 4000);
    };

    const handlePrintArchivedLetter = (letter: CommitmentLetter) => {
        handleShowArchivedLetter(letter);
        setIsPrintingArchived(true);
    };

    const { creditLimit, remainingCredit, isOverLimit } = useMemo(() => {
        const factors = Number(decreeFactors || '0');
        const amount = Number(loanAmount || '0');
        const creditLimit = factors * 30;
        const remainingCredit = creditLimit - totalCommitted;
        const isOverLimit = amount > remainingCredit;
        return { creditLimit, remainingCredit, isOverLimit };
    }, [decreeFactors, loanAmount, totalCommitted]);

    const guarantorSummary = useMemo(() => {
        if (!archivedLetters || archivedLetters.length === 0) return [];
        
        const summary = archivedLetters.reduce((acc, letter) => {
            const code = letter.guarantor_personnel_code;
            if (!acc[code]) {
                acc[code] = {
                    guarantor_personnel_code: code,
                    guarantor_name: letter.guarantor_name,
                    letterCount: 0,
                    totalAmount: 0,
                    letters: [],
                };
            }
            acc[code].letterCount += 1;
            acc[code].totalAmount += Number(letter.loan_amount);
            acc[code].letters.push(letter);
            return acc;
        }, {} as Record<string, { guarantor_personnel_code: string; guarantor_name: string; letterCount: number; totalAmount: number; letters: CommitmentLetter[] }>);

        return Object.values(summary).sort((a: any, b: any) => b.totalAmount - a.totalAmount);
    // FIX: Add explicit any type to sort callback arguments to fix 'property does not exist on type unknown' error.
    }, [archivedLetters]);
    
    const { paginatedGuarantors, totalArchivePages } = useMemo(() => {
        const startIndex = (archiveCurrentPage - 1) * ARCHIVE_PAGE_SIZE;
        const endIndex = startIndex + ARCHIVE_PAGE_SIZE;
        return {
            paginatedGuarantors: guarantorSummary.slice(startIndex, endIndex),
            totalArchivePages: Math.ceil(guarantorSummary.length / ARCHIVE_PAGE_SIZE),
        };
    }, [guarantorSummary, archiveCurrentPage]);
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">صدور نامه تعهد کسر حقوق</h2>
                {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form side */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Guarantor Selection */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                           <h3 className="text-lg font-bold mb-2">۱. انتخاب ضامن</h3>
                           {!selectedGuarantor ? (
                                <div>
                                    <div className="relative">
                                        <input type="text" className="w-full pr-10 pl-4 py-2 border rounded-md" placeholder="جستجوی نام یا کد پرسنلی ضامن..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                    {personnelLoading ? <p className="text-center text-gray-500 mt-2">...</p> : (
                                    <ul className="mt-2 border rounded-md bg-white max-h-40 overflow-y-auto">
                                        {filteredPersonnel.map(p => (
                                            <li key={p.id} onClick={() => handleSelectGuarantor(p)} className="p-2 hover:bg-gray-100 cursor-pointer">{p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})</li>
                                        ))}
                                    </ul>
                                    )}
                                </div>
                           ) : (
                                <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-blue-800">{selectedGuarantor.first_name} {selectedGuarantor.last_name}</p>
                                        <p className="text-sm text-blue-700">کد پرسنلی: {toPersianDigits(selectedGuarantor.personnel_code)}</p>
                                    </div>
                                    <button onClick={handleClearGuarantor} className="text-red-500 hover:text-red-700 text-sm font-semibold">تغییر ضامن</button>
                                </div>
                           )}
                        </div>
                        {/* Recipient and Loan Info */}
                        <form onSubmit={handleSaveAndPrint} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                           <h3 className="text-lg font-bold mb-2">۲. اطلاعات وام</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">نام و نام خانوادگی وام گیرنده</label>
                                    <input value={recipientName} onChange={e => setRecipientName(e.target.value)} className="w-full p-2 border rounded-md" required disabled={!selectedGuarantor} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">کد ملی وام گیرنده</label>
                                    <input value={toPersianDigits(recipientNationalId)} onChange={e => setRecipientNationalId(toEnglishDigits(e.target.value))} className="w-full p-2 border rounded-md" required disabled={!selectedGuarantor} />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ وام (ریال)</label>
                                    <input value={toPersianDigits(formatCurrency(loanAmount))} onChange={e => setLoanAmount(toEnglishDigits(e.target.value))} className="w-full p-2 border rounded-md font-sans text-left" required disabled={!selectedGuarantor} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">شماره نامه ارجاع بانک (اختیاری)</label>
                                    <input value={toPersianDigits(referenceNumber)} onChange={e => setReferenceNumber(toEnglishDigits(e.target.value))} className="w-full p-2 border rounded-md" disabled={!selectedGuarantor} />
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">نام بانک</label>
                                    <input value={bankName} onChange={e => setBankName(e.target.value)} className="w-full p-2 border rounded-md" required disabled={!selectedGuarantor} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">نام شعبه</label>
                                    <input value={branchName} onChange={e => setBranchName(e.target.value)} className="w-full p-2 border rounded-md" required disabled={!selectedGuarantor} />
                                </div>
                            </div>
                             <div className="pt-4 flex justify-end">
                                <button type="submit" disabled={!selectedGuarantor || isPrintingArchived} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                    <PrinterIcon className="w-5 h-5" /> ذخیره و چاپ نامه
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Credit Info Side */}
                    <div className="lg:col-span-1 space-y-4">
                       <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-full">
                           <h3 className="text-lg font-bold mb-2">۳. بررسی اعتبار ضامن</h3>
                           {selectedGuarantor ? (
                               <div className="space-y-3">
                                   <div className="flex items-center">
                                       <label className="w-32 text-sm">جمع عوامل حکمی:</label>
                                       <div className="flex-grow flex items-center">
                                            <input value={toPersianDigits(formatCurrency(decreeFactors))} onChange={e => setDecreeFactors(toEnglishDigits(e.target.value))} className="flex-grow p-2 border rounded-md font-sans text-left" />
                                            <button onClick={handleRefreshDecreeFactors} className="mr-2 p-2 text-blue-600 hover:bg-blue-100 rounded-full" title="بارگذاری مجدد از پرونده"><RefreshIcon className="w-5 h-5"/></button>
                                       </div>
                                   </div>
                                    <div className="p-3 bg-blue-50 border-t border-b border-blue-200">
                                       <p className="text-sm text-blue-800">حداکثر اعتبار ضمانت (ریال):</p>
                                       <p className="text-xl font-bold font-sans text-blue-900">{toPersianDigits(formatCurrency(creditLimit))}</p>
                                   </div>
                                    <div className="p-3 bg-yellow-50 border-t border-b border-yellow-200">
                                       <p className="text-sm text-yellow-800">مجموع تعهدات قبلی (ریال):</p>
                                       {loadingCommitment ? <p>...</p> : <p className="text-xl font-bold font-sans text-yellow-900">{toPersianDigits(formatCurrency(totalCommitted))}</p>}
                                   </div>
                                    <div className={`p-3 rounded-b-lg ${isOverLimit ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border-t border-b`}>
                                       <p className={`text-sm ${isOverLimit ? 'text-red-800' : 'text-green-800'}`}>مانده اعتبار (ریال):</p>
                                       <p className={`text-xl font-bold font-sans ${isOverLimit ? 'text-red-900' : 'text-green-900'}`}>{toPersianDigits(formatCurrency(remainingCredit))}</p>
                                       {isOverLimit && <p className="text-xs text-red-700 mt-1">مبلغ وام درخواستی از مانده اعتبار ضامن بیشتر است!</p>}
                                   </div>
                               </div>
                           ) : <p className="text-center text-gray-500 py-10">یک ضامن انتخاب کنید.</p>}
                       </div>
                       <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                           <h3 className="text-lg font-bold mb-2">تنظیمات چاپ</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsAdjusting(!isAdjusting)} className="px-4 py-2 bg-yellow-500 text-white rounded-lg">{isAdjusting ? 'پایان تنظیم' : 'تنظیم موقعیت'}</button>
                                {isAdjusting && (
                                    <>
                                        <button onClick={handleSavePosition} className="px-4 py-2 bg-green-500 text-white rounded-lg">ذخیره</button>
                                        <button onClick={handleResetPosition} className="px-4 py-2 bg-gray-500 text-white rounded-lg">ریست</button>
                                    </>
                                )}
                            </div>
                             {isAdjusting && <p className="text-xs text-gray-500 mt-2">برای جابجایی متن نامه روی پیش‌نمایش کلیک کرده و بکشید.</p>}
                       </div>
                    </div>
                </div>
            </div>

            {/* Print Preview */}
            <div className="hidden">
                <div ref={printRef} style={{ fontFamily: 'Amiri, serif', direction: 'rtl', lineHeight: '2.5', fontSize: '16px' }}>
                    {/* ... print content ... */}
                </div>
            </div>
            
            {/* Archive Section */}
            <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
                <div className="flex items-center gap-3 mb-6 border-b-2 border-gray-100 pb-4">
                    <DocumentIcon className="w-8 h-8 text-indigo-600"/>
                    <h2 className="text-2xl font-bold text-gray-800">بایگانی تعهدات</h2>
                </div>
                {/* ... archive table ... */}
            </div>

            {isEditModalOpen && editingLetter && (
                <EditCommitmentLetterModal
                    letter={editingLetter}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveLetter}
                />
            )}
        </div>
    );
};

export default AccountingCommitmentPage;
