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
        const isOverLimit = amount > remainingCredit && amount > 0;
        return { creditLimit, remainingCredit, isOverLimit };
    }, [decreeFactors, loanAmount, totalCommitted]);

    const handleLoanAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = toEnglishDigits(e.target.value).replace(/,/g, '');
        if (/^\d*$/.test(val)) {
            setLoanAmount(val);
        }
    };

    const handleDecreeFactorsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = toEnglishDigits(e.target.value).replace(/,/g, '');
        if (/^\d*$/.test(val)) {
            setDecreeFactors(val);
        }
    };

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
    }, [archivedLetters]);

     const paginatedGuarantorSummary = useMemo(() => {
        const startIndex = (archiveCurrentPage - 1) * ARCHIVE_PAGE_SIZE;
        return guarantorSummary.slice(startIndex, startIndex + ARCHIVE_PAGE_SIZE);
    }, [guarantorSummary, archiveCurrentPage]);
    
    const toggleGuarantorExpansion = (code: string) => {
        setExpandedGuarantors(prev => {
            const newSet = new Set(prev);
            if (newSet.has(code)) {
                newSet.delete(code);
            } else {
                newSet.add(code);
            }
            return newSet;
        });
    };
    
    // --- Drag Logic ---
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragInfo.current.isDragging) return;
        const dx = e.clientX - dragInfo.current.startX;
        const dy = e.clientY - dragInfo.current.startY;
        setPosition({
            x: dragInfo.current.initialX + dx,
            y: dragInfo.current.initialY + dy,
        });
    }, []);

    const handleMouseUp = useCallback(() => {
        dragInfo.current.isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAdjusting) return;
        e.preventDefault();
        dragInfo.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y,
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [isAdjusting, position.x, position.y, handleMouseMove, handleMouseUp]);

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">صدور و بایگانی نامه تعهد کسر از حقوق</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h3 className="font-bold text-gray-700 mb-2">۱. انتخاب ضامن</h3>
                        <div className="relative">
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass} placeholder="جستجوی نام یا کد پرسنلی ضامن..." disabled={!!selectedGuarantor} />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                         {filteredPersonnel.length > 0 && (
                            <ul className="mt-2 border rounded-md bg-white max-h-48 overflow-y-auto">
                                {filteredPersonnel.map(p => (
                                    <li key={p.id} onClick={() => handleSelectGuarantor(p)} className="p-2 hover:bg-gray-100 cursor-pointer text-sm">
                                        {p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                     {selectedGuarantor && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
                             <div className="flex justify-between items-center">
                                <h3 className="font-bold text-blue-800">مشخصات ضامن</h3>
                                <button onClick={handleClearGuarantor} className="text-xs text-red-600 hover:underline">تغییر ضامن</button>
                             </div>
                            <p className="text-sm"><strong>نام:</strong> {selectedGuarantor.first_name} {selectedGuarantor.last_name}</p>
                            <p className="text-sm"><strong>کد پرسنلی:</strong> {toPersianDigits(selectedGuarantor.personnel_code)}</p>
                            <p className="text-sm"><strong>کد ملی:</strong> {toPersianDigits(selectedGuarantor.national_id)}</p>
                            <div className="pt-2 mt-2 border-t space-y-1">
                                <p className="text-sm"><strong>سقف تعهد (۳۰ برابر حکم):</strong> <span className="font-sans">{toPersianDigits(formatCurrency(creditLimit))} ریال</span></p>
                                <p className="text-sm"><strong>تعهدات قبلی:</strong> <span className="font-sans">{loadingCommitment ? '...' : `${toPersianDigits(formatCurrency(totalCommitted))} ریال`}</span></p>
                                <p className={`text-sm font-bold ${remainingCredit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    <strong>اعتبار باقیمانده:</strong> <span className="font-sans">{toPersianDigits(formatCurrency(remainingCredit))} ریال</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="lg:col-span-2 space-y-6">
                     <form onSubmit={handleSaveAndPrint} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                        <h3 className="font-bold text-gray-700 mb-2">۲. اطلاعات وام و وام گیرنده</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div><label className="text-sm">نام وام گیرنده</label><input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">کد ملی وام گیرنده</label><input type="text" value={recipientNationalId} onChange={e => setRecipientNationalId(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">مبلغ وام (ریال)</label><input type="text" value={toPersianDigits(formatCurrency(loanAmount))} onChange={handleLoanAmountChange} className={inputClass} required/></div>
                             <div>
                                <label className="text-sm">جمع عوامل حکمی ضامن (ریال)</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={toPersianDigits(formatCurrency(decreeFactors))} 
                                        onChange={handleDecreeFactorsChange} 
                                        className={inputClass} 
                                        disabled={!selectedGuarantor}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={handleRefreshDecreeFactors}
                                        className="p-2 bg-slate-200 rounded-md hover:bg-slate-300 disabled:opacity-50"
                                        title="بازیابی از اطلاعات پرسنل"
                                        disabled={!selectedGuarantor}
                                    >
                                        <RefreshIcon className="w-5 h-5 text-gray-600" />
                                    </button>
                                </div>
                            </div>
                             <div><label className="text-sm">نام بانک</label><input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">نام شعبه</label><input type="text" value={branchName} onChange={e => setBranchName(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">شماره نامه ارجاع بانک</label><input type="text" value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} className={inputClass}/></div>
                        </div>
                         {isOverLimit && (
                            <div className="p-3 text-sm rounded-lg bg-red-100 text-red-800 text-center">
                                هشدار: مبلغ وام درخواستی از اعتبار باقیمانده ضامن بیشتر است!
                            </div>
                         )}
                        <div className="flex justify-end gap-2 pt-4">
                            <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400" disabled={!selectedGuarantor}><PrinterIcon className="w-5 h-5"/> ذخیره و چاپ</button>
                        </div>
                     </form>
                </div>
            </div>

            <div className="mt-8 border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">۳. پیش نمایش و تنظیم نامه جهت چاپ</h3>
                    <div className="flex items-center gap-2">
                        {!isAdjusting ? (
                            <button onClick={() => setIsAdjusting(true)} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                                تنظیم چیدمان
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
                                <span className="text-sm font-semibold text-blue-700">حالت تنظیم</span>
                                <button onClick={handleSavePosition} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره</button>
                                <button onClick={handleResetPosition} className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">بازنشانی</button>
                                <button onClick={() => setIsAdjusting(false)} className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200">اتمام</button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="border rounded-lg bg-gray-50 text-gray-800 relative overflow-hidden" style={{ minHeight: '800px' }}>
                    <div
                        onMouseDown={handleMouseDown}
                        className={`transition-shadow p-8 ${isAdjusting ? 'shadow-2xl border-2 border-dashed border-blue-500' : ''}`}
                        style={{
                            position: 'absolute',
                            top: `${position.y}px`,
                            left: `${position.x}px`,
                            cursor: isAdjusting ? 'move' : 'default',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div ref={printRef} style={{ direction: 'rtl', lineHeight: '2.5' }}>
                            <p className="font-bold my-8">ریاست محترم بانک <span className="underline">{bankName || '....................'}</span> شعبه <span className="underline">{branchName || '....................'}</span></p>
                            
                            <p>
                                احتراماً، بدینوسیله گواهی می‌شود آقای/خانم <span className="underline">{selectedGuarantor ? `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}` : '..............................'}</span> به شماره پرسنلی <span className="underline">{toPersianDigits(selectedGuarantor?.personnel_code)}</span> و کد ملی <span className="underline">{toPersianDigits(selectedGuarantor?.national_id)}</span> کارمند این شرکت بوده و این شرکت متعهد می‌گردد در صورت عدم پرداخت اقساط وام دریافتی آقای/خانم <span className="underline">{recipientName || '..............................'}</span> به کد ملی <span className="underline">{toPersianDigits(recipientNationalId)}</span> به مبلغ <span className="underline">{toPersianDigits(formatCurrency(loanAmount))}</span> ریال، پس از اعلام کتبی بانک، نسبت به کسر از حقوق و مزایای ضامن و واریز به حساب آن بانک اقدام نماید.
                            </p>
                            <p>این گواهی صرفاً جهت اطلاع بانک صادر گردیده و فاقد هرگونه ارزش و اعتبار دیگری می‌باشد.</p>
                            <br />
                            <div className="signature text-left">
                                <p className="font-bold">با تشکر</p>
                                <p className="font-bold">مدیریت سرمایه انسانی</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">۴. بایگانی و خلاصه تعهدات</h3>
                 <form onSubmit={handleArchiveSearchSubmit} className="mb-6">
                    <label htmlFor="search-letters" className="block text-sm font-medium text-gray-700 mb-2">
                        جستجو در بایگانی
                    </label>
                    <div className="flex">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                id="search-letters"
                                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="نام وام‌گیرنده، ضامن، کد ملی، کد پرسنلی..."
                                value={archiveSearchTerm}
                                onChange={e => setArchiveSearchTerm(e.target.value)}
                            />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-l-md hover:bg-blue-700">جستجو</button>
                    </div>
                </form>
                
                <div className="overflow-x-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {archiveLoading && <p className="text-center py-4">در حال بارگذاری بایگانی...</p>}
                    {archiveError && <p className="text-center py-4 text-red-500">{archiveError}</p>}
                    {!archiveLoading && !archiveError && guarantorSummary.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <DocumentReportIcon className="w-16 h-16 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold">
                                {archiveSearchTerm ? 'هیچ نامه‌ای مطابق با جستجوی شما یافت نشد.' : 'هیچ نامه‌ای در بایگانی ثبت نشده است.'}
                            </h3>
                        </div>
                    )}
                     {!archiveLoading && !archiveError && guarantorSummary.length > 0 && (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    {['ضامن', 'کد پرسنلی', 'تعداد تعهدات', 'جمع مبالغ (ریال)', 'جزئیات'].map(h => (
                                        <th key={h} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                               {paginatedGuarantorSummary.map(summaryItem => (
                                   <React.Fragment key={summaryItem.guarantor_personnel_code}>
                                       <tr className="cursor-pointer hover:bg-slate-100" onClick={() => toggleGuarantorExpansion(summaryItem.guarantor_personnel_code)}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">{summaryItem.guarantor_name}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(summaryItem.guarantor_personnel_code)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(summaryItem.letterCount)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-sans font-bold">{toPersianDigits(formatCurrency(summaryItem.totalAmount))}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                {expandedGuarantors.has(summaryItem.guarantor_personnel_code) ? <ChevronUpIcon className="w-5 h-5 mx-auto" /> : <ChevronDownIcon className="w-5 h-5 mx-auto" />}
                                            </td>
                                       </tr>
                                       {expandedGuarantors.has(summaryItem.guarantor_personnel_code) && (
                                           <tr>
                                               <td colSpan={5} className="p-4 bg-gray-50 border-b-2 border-blue-200">
                                                   <h4 className="font-bold mb-2">جزئیات تعهدات {summaryItem.guarantor_name}:</h4>
                                                   <div className="overflow-x-auto border rounded-lg">
                                                       <table className="min-w-full divide-y divide-gray-200">
                                                            <thead className="bg-gray-200">
                                                                <tr>
                                                                    {['وام گیرنده', 'مبلغ وام (ریال)', 'بانک', 'تاریخ صدور', 'عملیات'].map(h => (
                                                                        <th key={h} scope="col" className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-gray-200">
                                                                {summaryItem.letters.map(letter => (
                                                                    <tr key={letter.id}>
                                                                        <td className="px-3 py-2 whitespace-nowrap text-sm"><p className="font-semibold">{letter.recipient_name}</p><p className="text-xs text-gray-500">کد ملی: {toPersianDigits(letter.recipient_national_id)}</p></td>
                                                                        <td className="px-3 py-2 whitespace-nowrap text-sm font-sans">{toPersianDigits(formatCurrency(letter.loan_amount))}</td>
                                                                        <td className="px-3 py-2 whitespace-nowrap text-sm">{letter.bank_name} - {letter.branch_name}</td>
                                                                        <td className="px-3 py-2 whitespace-nowrap text-sm">{toPersianDigits(new Date(letter.issue_date).toLocaleDateString('fa-IR'))}</td>
                                                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <button onClick={() => handleShowArchivedLetter(letter)} className="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors" aria-label={`نمایش نامه ${letter.id}`}>
                                                                                    <DocumentIcon className="w-5 h-5" />
                                                                                </button>
                                                                                <button onClick={() => handlePrintArchivedLetter(letter)} className="text-gray-600 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors" aria-label={`چاپ نامه ${letter.id}`}>
                                                                                    <PrinterIcon className="w-5 h-5" />
                                                                                </button>
                                                                                <button onClick={() => handleEditClick(letter)} className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors" aria-label={`ویرایش نامه ${letter.id}`}>
                                                                                    <PencilIcon className="w-5 h-5" />
                                                                                </button>
                                                                                <button onClick={() => handleDeleteLetter(letter.id)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors ml-1" aria-label={`حذف نامه ${letter.id}`}>
                                                                                    <TrashIcon className="w-5 h-5" />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                       </table>
                                                   </div>
                                               </td>
                                           </tr>
                                       )}
                                   </React.Fragment>
                               ))}
                            </tbody>
                        </table>
                    )}
                </div>
                 {(() => {
                    const totalArchivePages = Math.ceil(guarantorSummary.length / ARCHIVE_PAGE_SIZE);
                    if (!archiveLoading && !archiveError && totalArchivePages > 1) {
                        return (
                            <div className="flex justify-center items-center gap-4 mt-4">
                                <button
                                    onClick={() => setArchiveCurrentPage(p => Math.max(p - 1, 1))}
                                    disabled={archiveCurrentPage === 1}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                                >
                                    قبلی
                                </button>
                                <span className="text-sm text-gray-600">
                                    صفحه {toPersianDigits(archiveCurrentPage)} از {toPersianDigits(totalArchivePages)}
                                </span>
                                <button
                                    onClick={() => setArchiveCurrentPage(p => Math.min(p + 1, totalArchivePages))}
                                    disabled={archiveCurrentPage === totalArchivePages}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                                >
                                    بعدی
                                </button>
                            </div>
                        );
                    }
                    return null;
                })()}
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