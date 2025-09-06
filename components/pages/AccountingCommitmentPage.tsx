import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Personnel } from '../../types';
import { SearchIcon, PrinterIcon, RefreshIcon, DocumentReportIcon, TrashIcon } from '../icons/Icons';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '۰';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

interface CommitmentLetter {
    id: number;
    recipient_name: string;
    recipient_national_id: string;
    guarantor_name: string;
    guarantor_personnel_code: string;
    loan_amount: string;
    bank_name: string;
    branch_name: string;
    issue_date: string;
}

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

    const printRef = useRef<HTMLDivElement>(null);

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
        setDecreeFactors(formatCurrency(person.sum_of_decree_factors || '0'));
    };
    
    const handleRefreshDecreeFactors = useCallback(() => {
        if (selectedGuarantor) {
            setDecreeFactors(formatCurrency(selectedGuarantor.sum_of_decree_factors || '0'));
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

    const handlePrint = () => {
        const printContent = printRef.current?.innerHTML;
        if (printContent) {
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow?.document.write('<html><head><title>چاپ نامه تعهد</title>');
            printWindow?.document.write('<link rel="preconnect" href="https://fonts.googleapis.com">');
            printWindow?.document.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
            printWindow?.document.write('<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap" rel="stylesheet">');
            printWindow?.document.write('<style> body { font-family: "Vazirmatn", sans-serif; direction: rtl; line-height: 2.5; padding: 20px; } .signature { margin-top: 100px; text-align: center; } .underline { border-bottom: 1px dotted black; padding: 0 5px; font-weight: bold; } </style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(printContent);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.focus();
            printWindow?.print();
        }
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
                loan_amount: Number(loanAmount.replace(/,/g, '')),
                sum_of_decree_factors: Number((decreeFactors || '0').replace(/,/g, '')),
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

        } catch(err) {
             setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره نامه' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleArchiveSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
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

    const { creditLimit, remainingCredit, isOverLimit } = useMemo(() => {
        const factors = Number((decreeFactors || '0').replace(/,/g, ''));
        const amount = Number((loanAmount || '0').replace(/,/g, ''));
        const creditLimit = factors * 30;
        const remainingCredit = creditLimit - totalCommitted;
        const isOverLimit = amount > remainingCredit && amount > 0;
        return { creditLimit, remainingCredit, isOverLimit };
    }, [decreeFactors, loanAmount, totalCommitted]);

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">صدور نامه تعهد کسر از حقوق</h2>
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
                                <p className="text-sm"><strong>سقف تعهد (۳۰ برابر حکم):</strong> <span className="font-mono">{toPersianDigits(formatCurrency(creditLimit))} ریال</span></p>
                                <p className="text-sm"><strong>تعهدات قبلی:</strong> <span className="font-mono">{loadingCommitment ? '...' : `${toPersianDigits(formatCurrency(totalCommitted))} ریال`}</span></p>
                                <p className={`text-sm font-bold ${remainingCredit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    <strong>اعتبار باقیمانده:</strong> <span className="font-mono">{toPersianDigits(formatCurrency(remainingCredit))} ریال</span>
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
                             <div><label className="text-sm">مبلغ وام (ریال)</label><input type="text" value={loanAmount} onChange={e => setLoanAmount(formatCurrency(e.target.value))} className={inputClass} required/></div>
                             <div>
                                <label className="text-sm">جمع عوامل حکمی ضامن (ریال)</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={decreeFactors} 
                                        onChange={e => setDecreeFactors(formatCurrency(e.target.value))} 
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
                <h3 className="text-xl font-bold text-gray-800 mb-4">۳. پیش نمایش نامه جهت چاپ</h3>
                <div ref={printRef} className="p-8 border rounded-lg bg-gray-50 text-gray-800 print-container" style={{ direction: 'rtl', lineHeight: '2.5' }}>
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <p>تاریخ: <span className="font-mono">{toPersianDigits(new Date().toLocaleDateString('fa-IR'))}</span></p>
                            <p>شماره: <span className="font-mono">{toPersianDigits(referenceNumber) || '....................'}</span></p>
                            <p>پیوست: ندارد</p>
                        </div>
                        <p className="text-center font-bold text-lg">بسمه تعالی</p>
                        <div></div>
                    </div>
                    
                    <p className="font-bold mb-4">ریاست محترم بانک <span className="underline">{bankName || '....................'}</span> شعبه <span className="underline">{branchName || '....................'}</span></p>
                    
                    <p>
                        احتراماً، بدینوسیله گواهی می‌شود آقای/خانم <span className="underline">{selectedGuarantor ? `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}` : '..............................'}</span> به شماره پرسنلی <span className="underline">{toPersianDigits(selectedGuarantor?.personnel_code)}</span> و کد ملی <span className="underline">{toPersianDigits(selectedGuarantor?.national_id)}</span> کارمند این شرکت بوده و این شرکت متعهد می‌گردد در صورت عدم پرداخت اقساط وام دریافتی آقای/خانم <span className="underline">{recipientName || '..............................'}</span> به کد ملی <span className="underline">{toPersianDigits(recipientNationalId)}</span> به مبلغ <span className="underline">{toPersianDigits(formatCurrency(loanAmount))}</span> ریال، پس از اعلام کتبی بانک، نسبت به کسر از حقوق و مزایای ضامن و واریز به حساب آن بانک اقدام نماید.
                    </p>
                    <p>این گواهی صرفاً جهت اطلاع بانک صادر گردیده و فاقد هرگونه ارزش و اعتبار دیگری می‌باشد.</p>
                    <br />
                    <div className="signature">
                        <p className="font-bold">با تشکر</p>
                        <p className="font-bold">مدیریت سرمایه انسانی</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">۴. بایگانی نامه‌های صادر شده</h3>
                 <form onSubmit={handleArchiveSearchSubmit} className="mb-6">
                    <div className="flex">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-r-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="جستجو در بایگانی..."
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
                {!archiveLoading && !archiveError && archivedLetters.length === 0 && (
                    <div className="text-center py-10 text-gray-400">
                        <DocumentReportIcon className="w-16 h-16 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">
                            {archiveSearchTerm ? 'هیچ نامه‌ای مطابق با جستجوی شما یافت نشد.' : 'هیچ نامه‌ای در بایگانی ثبت نشده است.'}
                        </h3>
                    </div>
                )}
                {!archiveLoading && !archiveError && archivedLetters.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                {['وام گیرنده', 'ضامن', 'مبلغ وام (ریال)', 'بانک', 'تاریخ صدور', 'عملیات'].map(h => (
                                    <th key={h} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                           {archivedLetters.map(letter => (
                               <tr key={letter.id}>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm"><p className="font-semibold">{letter.recipient_name}</p><p className="text-xs text-gray-500">کد ملی: {toPersianDigits(letter.recipient_national_id)}</p></td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm"><p className="font-semibold">{letter.guarantor_name}</p><p className="text-xs text-gray-500">کد پرسنلی: {toPersianDigits(letter.guarantor_personnel_code)}</p></td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">{toPersianDigits(formatCurrency(letter.loan_amount))}</td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm">{letter.bank_name} - {letter.branch_name}</td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(letter.issue_date).toLocaleDateString('fa-IR'))}</td>
                                   <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                       <button onClick={() => handleDeleteLetter(letter.id)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors" aria-label={`حذف نامه ${letter.id}`}>
                                           <TrashIcon className="w-5 h-5" />
                                       </button>
                                   </td>
                               </tr>
                           ))}
                        </tbody>
                    </table>
                )}
            </div>
            </div>
        </div>
    );
};

export default AccountingCommitmentPage;