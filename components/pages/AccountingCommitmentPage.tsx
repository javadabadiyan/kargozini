import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Personnel } from '../../types';
import { SearchIcon, PrinterIcon, RefreshIcon, DocumentReportIcon, TrashIcon, PencilIcon } from '../icons/Icons';

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
    if (!value) return '0';
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
    guarantor_national_id: string;
    loan_amount: number;
    sum_of_decree_factors: number;
    bank_name: string;
    branch_name: string;
    reference_number: string;
    issue_date: string;
}

const AccountingCommitmentPage: React.FC = () => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuarantor, setSelectedGuarantor] = useState<Personnel | null>(null);

    // Form state
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

    // Archive state
    const [archivedLetters, setArchivedLetters] = useState<CommitmentLetter[]>([]);
    const [archiveLoading, setArchiveLoading] = useState(true);
    const [archiveSearchTerm, setArchiveSearchTerm] = useState('');

    // Edit state
    const [editingLetterId, setEditingLetterId] = useState<number | null>(null);

    const printRef = useRef<HTMLDivElement>(null);
    const pageTopRef = useRef<HTMLHeadingElement>(null);
    

    const fetchInitialData = useCallback(async () => {
        setPersonnelLoading(true);
        setArchiveLoading(true);
        try {
            const [personnelRes, lettersRes, refRes] = await Promise.all([
                fetch('/api/personnel?type=personnel&pageSize=100000'),
                fetch(`/api/personnel?type=commitment_letters&searchTerm=${encodeURIComponent(archiveSearchTerm)}`),
                fetch('/api/personnel?type=commitment_letters&latest_ref=true')
            ]);

            if (!personnelRes.ok) throw new Error('خطا در دریافت لیست پرسنل');
            const personnelData = await personnelRes.json();
            setPersonnelList(personnelData.personnel || []);

            if (!lettersRes.ok) throw new Error('خطا در دریافت بایگانی نامه‌ها');
            const lettersData = await lettersRes.json();
            setArchivedLetters(lettersData.letters || []);

            if (refRes.ok && !editingLetterId) {
                const refData = await refRes.json();
                setReferenceNumber(refData.next_reference_number || '');
            }

        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد' });
        } finally {
            setPersonnelLoading(false);
            setArchiveLoading(false);
        }
    }, [archiveSearchTerm, editingLetterId]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

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
        setDecreeFactors(person.sum_of_decree_factors || '0');
    };
    
    const handleRefreshDecreeFactors = useCallback(() => {
        if (selectedGuarantor) {
            setDecreeFactors(selectedGuarantor.sum_of_decree_factors || '0');
        }
    }, [selectedGuarantor]);
    
    const resetForm = useCallback(() => {
        setRecipientName('');
        setRecipientNationalId('');
        setLoanAmount('');
        setBankName('');
        setBranchName('');
        setEditingLetterId(null);
        // Fetch new ref number after clearing form
        fetch('/api/personnel?type=commitment_letters&latest_ref=true')
            .then(res => res.json())
            .then(data => setReferenceNumber(data.next_reference_number || ''));
    }, []);

    const handleClearGuarantor = useCallback(() => {
        setSelectedGuarantor(null);
        setSearchTerm('');
        setDecreeFactors('');
        resetForm();
    }, [resetForm]);

    const handlePrint = () => {
        if (!selectedGuarantor || !recipientName || !loanAmount) {
            setStatus({ type: 'error', message: 'برای چاپ، لطفا اطلاعات ضامن و وام‌گیرنده را کامل کنید.' });
            setTimeout(() => setStatus(null), 4000);
            return;
        }
        const printContent = printRef.current?.innerHTML;
        if (printContent) {
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow?.document.write('<html><head><title>چاپ نامه تعهد</title>');
            printWindow?.document.write('<link rel="preconnect" href="https://fonts.googleapis.com">');
            printWindow?.document.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
            printWindow?.document.write('<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap" rel="stylesheet">');
            printWindow?.document.write('<style> body { font-family: "Vazirmatn", sans-serif; direction: rtl; line-height: 2.5; } .signature { margin-top: 100px; text-align: left; padding-left: 50px; } .underline { border-bottom: 1px dotted black; padding: 0 5px; font-weight: bold; } </style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(printContent);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.focus();
            printWindow?.print();
        }
    };
    
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGuarantor) {
            setStatus({ type: 'error', message: 'لطفا ابتدا یک ضامن را انتخاب کنید.' });
            return;
        }
        
        const isEditing = !!editingLetterId;
        setStatus({ type: 'info', message: isEditing ? 'در حال ویرایش نامه...' : 'در حال ذخیره نامه...' });

        const payload = {
            id: editingLetterId,
            recipient_name: recipientName,
            recipient_national_id: recipientNationalId,
            guarantor_personnel_code: selectedGuarantor.personnel_code,
            guarantor_name: `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}`,
            guarantor_national_id: selectedGuarantor.national_id,
            loan_amount: Number(toEnglishDigits(loanAmount).replace(/,/g, '')),
            sum_of_decree_factors: Number(toEnglishDigits(decreeFactors || '0').replace(/,/g, '')),
            bank_name: bankName,
            branch_name: branchName,
            reference_number: referenceNumber,
        };

        try {
            const response = await fetch('/api/personnel?type=commitment_letters', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setStatus({ type: 'success', message: data.message });
            handleClearGuarantor();
            fetchInitialData();
        } catch(err) {
             setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در عملیات' });
        } finally {
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handleEditClick = (letter: CommitmentLetter) => {
        const guarantor = personnelList.find(p => p.personnel_code === letter.guarantor_personnel_code);
        if (guarantor) {
            setSelectedGuarantor(guarantor);
        }
        setEditingLetterId(letter.id);
        setRecipientName(letter.recipient_name);
        setRecipientNationalId(letter.recipient_national_id);
        setLoanAmount(String(letter.loan_amount));
        setBankName(letter.bank_name);
        setBranchName(letter.branch_name);
        setReferenceNumber(letter.reference_number);
        setDecreeFactors(String(letter.sum_of_decree_factors));
        pageTopRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('آیا از حذف این نامه از بایگانی اطمینان دارید؟')) {
            setStatus({ type: 'info', message: 'در حال حذف نامه...'});
            try {
                const response = await fetch(`/api/personnel?type=commitment_letters&id=${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                setStatus({ type: 'success', message: data.message });
                fetchInitialData();
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در حذف نامه' });
            } finally {
                setTimeout(() => setStatus(null), 4000);
            }
        }
    };
    
    const handleCurrencyInputChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
        const val = e.target.value;
        const englishVal = toEnglishDigits(val).replace(/,/g, '');
        if (/^\d*$/.test(englishVal)) { setter(englishVal); }
    };

    const { creditLimit, remainingCredit, isOverLimit } = useMemo(() => {
        const factors = Number(toEnglishDigits(decreeFactors || '0').replace(/,/g, ''));
        const amount = Number(toEnglishDigits(loanAmount || '0').replace(/,/g, ''));
        const creditLimit = factors * 30;
        const committedAmount = editingLetterId 
            ? totalCommitted - (archivedLetters.find(l => l.id === editingLetterId)?.loan_amount || 0)
            : totalCommitted;
        const remainingCredit = creditLimit - committedAmount;
        const isOverLimit = amount > remainingCredit && amount > 0;
        return { creditLimit, remainingCredit, isOverLimit };
    }, [decreeFactors, loanAmount, totalCommitted, editingLetterId, archivedLetters]);

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };
    const inputClass = "w-full px-3 py-2 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg space-y-8">
            <div>
                <h2 ref={pageTopRef} className="text-2xl font-bold text-gray-800 mb-2">نامه تعهد کسر از حقوق</h2>
                <p className="text-sm text-gray-500">در این بخش می‌توانید برای پرسنل نامه تعهد صادر کرده و بایگانی نامه‌های قبلی را مشاهده کنید.</p>
            </div>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h3 className="font-bold text-gray-700 mb-2">{editingLetterId ? 'ویرایش ضامن' : '۱. انتخاب ضامن'}</h3>
                        <div className="relative">
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputClass} placeholder="جستجوی نام یا کد پرسنلی ضامن..." disabled={!!selectedGuarantor} />
                            <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        </div>
                         {filteredPersonnel.length > 0 && (
                            <ul className="mt-2 border rounded-md bg-white max-h-48 overflow-y-auto">
                                {filteredPersonnel.map(p => ( <li key={p.id} onClick={() => handleSelectGuarantor(p)} className="p-2 hover:bg-gray-100 cursor-pointer text-sm">{p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})</li> ))}
                            </ul>
                        )}
                    </div>
                     {selectedGuarantor && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-2">
                             <div className="flex justify-between items-center"><h3 className="font-bold text-blue-800">مشخصات ضامن</h3><button onClick={handleClearGuarantor} className="text-xs text-red-600 hover:underline">تغییر ضامن</button></div>
                            <p className="text-sm"><strong>نام:</strong> {selectedGuarantor.first_name} {selectedGuarantor.last_name}</p>
                            <p className="text-sm"><strong>کد پرسنلی:</strong> {toPersianDigits(selectedGuarantor.personnel_code)}</p>
                            <p className="text-sm"><strong>کد ملی:</strong> {toPersianDigits(selectedGuarantor.national_id)}</p>
                            <div className="pt-2 mt-2 border-t space-y-1">
                                <p className="text-sm"><strong>سقف تعهد (۳۰ برابر حکم):</strong> <span className="font-mono">{toPersianDigits(formatCurrency(creditLimit))} ریال</span></p>
                                <p className="text-sm"><strong>تعهدات قبلی:</strong> <span className="font-mono">{loadingCommitment ? '...' : `${toPersianDigits(formatCurrency(totalCommitted))} ریال`}</span></p>
                                <p className={`text-sm font-bold ${remainingCredit < 0 ? 'text-red-600' : 'text-green-600'}`}><strong>اعتبار باقیمانده:</strong> <span className="font-mono">{toPersianDigits(formatCurrency(remainingCredit))} ریال</span></p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="lg:col-span-2 space-y-6">
                     <form onSubmit={handleSave} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                        <h3 className="font-bold text-gray-700 mb-2">{editingLetterId ? `ویرایش نامه شماره ${toPersianDigits(referenceNumber)}` : '۲. اطلاعات وام و وام گیرنده'}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div><label className="text-sm">نام و نام خانوادگی وام گیرنده</label><input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">کد ملی وام گیرنده</label><input type="text" value={toPersianDigits(recipientNationalId)} onChange={e => setRecipientNationalId(toEnglishDigits(e.target.value))} className={inputClass} required/></div>
                             <div><label className="text-sm">مبلغ وام (ریال)</label><input type="text" value={toPersianDigits(formatCurrency(loanAmount))} onChange={e => handleCurrencyInputChange(e, setLoanAmount)} className={inputClass} required/></div>
                             <div><label className="text-sm">جمع عوامل حکمی ضامن (ریال)</label><div className="flex items-center gap-2"><input type="text" value={toPersianDigits(formatCurrency(decreeFactors))} onChange={e => handleCurrencyInputChange(e, setDecreeFactors)} className={inputClass} disabled={!selectedGuarantor}/><button type="button" onClick={handleRefreshDecreeFactors} className="p-2 bg-slate-200 rounded-md hover:bg-slate-300 disabled:opacity-50" title="بازیابی از اطلاعات پرسنل" disabled={!selectedGuarantor}><RefreshIcon className="w-5 h-5 text-gray-600" /></button></div></div>
                             <div><label className="text-sm">نام بانک</label><input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">نام شعبه</label><input type="text" value={branchName} onChange={e => setBranchName(e.target.value)} className={inputClass} required/></div>
                             <div><label className="text-sm">شماره نامه</label><input type="text" value={toPersianDigits(referenceNumber)} onChange={e => setReferenceNumber(toEnglishDigits(e.target.value))} className={`${inputClass} bg-slate-200`} readOnly={!editingLetterId} /></div>
                        </div>
                         {isOverLimit && (<div className="p-3 text-sm rounded-lg bg-red-100 text-red-800 text-center">هشدار: مبلغ وام درخواستی از اعتبار باقیمانده ضامن بیشتر است!</div>)}
                        <div className="flex justify-end gap-2 pt-4">
                            {editingLetterId && <button type="button" onClick={handleClearGuarantor} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">لغو ویرایش</button>}
                            <button type="button" onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400" disabled={!selectedGuarantor}><PrinterIcon className="w-5 h-5"/> چاپ</button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400" disabled={!selectedGuarantor}>{editingLetterId ? 'بروزرسانی نامه' : 'ذخیره نامه'}</button>
                        </div>
                     </form>
                </div>
            </div>

            <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">بایگانی نامه‌های صادر شده</h3>
                <div ref={printRef} className="print-only" style={{ display: 'none' }}>
                    <div className="flex justify-between items-start mb-8"><div><p>تاریخ: <span className="font-mono">{toPersianDigits(new Date().toLocaleDateString('fa-IR'))}</span></p><p>شماره: <span className="font-mono">{toPersianDigits(referenceNumber) || '....................'}</span></p><p>پیوست: ندارد</p></div><p className="text-center font-bold text-lg">بسمه تعالی</p><div></div></div><p className="font-bold mb-4">ریاست محترم بانک <span className="underline">{bankName || '....................'}</span> شعبه <span className="underline">{branchName || '....................'}</span></p><p>احتراماً، بدینوسیله گواهی می‌شود آقای/خانم <span className="underline">{selectedGuarantor ? `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}` : '..............................'}</span> به شماره پرسنلی <span className="underline">{toPersianDigits(selectedGuarantor?.personnel_code)}</span> و کد ملی <span className="underline">{toPersianDigits(selectedGuarantor?.national_id)}</span> کارمند این شرکت بوده و این شرکت متعهد می‌گردد در صورت عدم پرداخت اقساط وام دریافتی آقای/خانم <span className="underline">{recipientName || '..............................'}</span> به کد ملی <span className="underline">{toPersianDigits(recipientNationalId)}</span> به مبلغ <span className="underline">{toPersianDigits(formatCurrency(loanAmount))}</span> ریال، پس از اعلام کتبی بانک، نسبت به کسر از حقوق و مزایای ضامن و واریز به حساب آن بانک اقدام نماید.</p><p>این گواهی صرفاً جهت اطلاع بانک صادر گردیده و فاقد هرگونه ارزش و اعتبار دیگری می‌باشد.</p><br /><div className="signature"><p className="font-bold">با تشکر</p><p className="font-bold">مدیریت سرمایه انسانی</p></div>
                </div>

                <div className="overflow-x-auto bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {archiveLoading ? <p>در حال بارگذاری بایگانی...</p> : (
                         <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>{['شماره نامه', 'وام گیرنده', 'ضامن', 'مبلغ وام (ریال)', 'بانک', 'تاریخ صدور', 'عملیات'].map(h => (<th key={h} scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>))}</tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {archivedLetters.map(letter => (
                                   <tr key={letter.id}>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">{toPersianDigits(letter.reference_number)}</td>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm"><p className="font-semibold">{letter.recipient_name}</p><p className="text-xs text-gray-500">کد ملی: {toPersianDigits(letter.recipient_national_id)}</p></td>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm"><p className="font-semibold">{letter.guarantor_name}</p><p className="text-xs text-gray-500">کد پرسنلی: {toPersianDigits(letter.guarantor_personnel_code)}</p></td>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">{toPersianDigits(formatCurrency(letter.loan_amount))}</td>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm">{letter.bank_name} - {letter.branch_name}</td>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm">{toPersianDigits(new Date(letter.issue_date).toLocaleDateString('fa-IR'))}</td>
                                       <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => handleEditClick(letter)} className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors" aria-label={`ویرایش نامه ${letter.id}`}><PencilIcon className="w-5 h-5" /></button>
                                                <button onClick={() => handleDelete(letter.id)} className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors" aria-label={`حذف نامه ${letter.id}`}><TrashIcon className="w-5 h-5" /></button>
                                            </div>
                                       </td>
                                   </tr>
                               ))}
                            </tbody>
                        </table>
                    )}
                    {!archiveLoading && archivedLetters.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            <DocumentReportIcon className="w-16 h-16 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold">هیچ نامه‌ای در بایگانی یافت نشد.</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountingCommitmentPage;