import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Personnel } from '../../types';
import { SearchIcon, PrinterIcon, RefreshIcon, UserIcon } from '../icons/Icons';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

const formatCurrency = (value: string | number): string => {
    if (value === null || value === undefined) return '';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const numberToPersianWords = (numStr: string): string => {
    if (!numStr || numStr === "0") return "صفر";
    const num = BigInt(numStr.replace(/,/g, ''));
    if (num === 0n) return "صفر";

    const units = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
    const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
    const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
    const hundreds = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
    const thousands = ["", " هزار", " میلیون", " میلیارد", " تریلیون"];

    const threeDigitToWords = (n: number): string => {
        let output = [];
        if (n >= 100) {
            output.push(hundreds[Math.floor(n / 100)]);
            n %= 100;
        }
        if (n >= 20) {
            output.push(tens[Math.floor(n / 10)]);
            n %= 10;
        } else if (n >= 10) {
            output.push(teens[n - 10]);
            n = 0;
        }
        if (n > 0) {
            output.push(units[n]);
        }
        return output.filter(Boolean).join(" و ");
    };
    
    let parts = [];
    let i = 0;
    let tempNum = num;

    while (tempNum > 0n) {
        const threeDigits = Number(tempNum % 1000n);
        if (threeDigits > 0) {
            parts.push(threeDigitToWords(threeDigits) + thousands[i]);
        }
        tempNum /= 1000n;
        i++;
    }
    return parts.reverse().join(" و ");
};


const SearchablePersonnelInput: React.FC<{
    label: string;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    results: Personnel[];
    onSelect: (person: Personnel) => void;
    selectedPerson: Personnel | null;
}> = ({ label, searchTerm, setSearchTerm, results, onSelect, selectedPerson }) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative">
                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder="جستجو با نام، کد پرسنلی یا کد ملی..."
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
            </div>
            {isFocused && searchTerm && results.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                    {results.map(p => (
                        <li
                            key={p.id}
                            onMouseDown={() => onSelect(p)}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                        >
                           {p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})
                        </li>
                    ))}
                </ul>
            )}
             {selectedPerson && (
                <div className="mt-2 p-2 bg-green-50 text-green-800 border border-green-200 rounded-md text-sm">
                    انتخاب شد: {selectedPerson.first_name} {selectedPerson.last_name}
                </div>
            )}
        </div>
    );
};

const AccountingCommitmentPage: React.FC = () => {
    const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);

    const [bankName, setBankName] = useState('بانک رفاه');
    const [branchName, setBranchName] = useState('شعبه مرکزی سیرجان');
    const [loanAmount, setLoanAmount] = useState('3000000000');
    
    const [recipientInfo, setRecipientInfo] = useState({ firstName: '', lastName: '', fatherName: '', nationalId: '' });

    const [guarantorSearch, setGuarantorSearch] = useState('');
    const [selectedGuarantor, setSelectedGuarantor] = useState<Personnel | null>(null);
    const [sumOfDecreeFactors, setSumOfDecreeFactors] = useState('');

    const [creditInfo, setCreditInfo] = useState({ limit: 0, committed: 0, remaining: 0 });
    const [creditLoading, setCreditLoading] = useState(false);

    const letterRef = useRef<HTMLDivElement>(null);
    const todayPersian = useMemo(() => new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), []);
    const referenceNumber = useMemo(() => `د/${Math.floor(100000 + Math.random() * 900000)}/${todayPersian.split('/')[0]}`, [todayPersian]);

    useEffect(() => {
        const fetchAllPersonnel = async () => {
            try {
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('خطا در دریافت لیست پرسنل');
                const data = await response.json();
                setAllPersonnel(data.personnel || []);
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        fetchAllPersonnel();
    }, []);
    
    useEffect(() => {
        if (!selectedGuarantor) {
            setCreditInfo({ limit: 0, committed: 0, remaining: 0 });
            return;
        }
        const fetchCreditInfo = async () => {
            setCreditLoading(true);
            try {
                const response = await fetch(`/api/personnel?type=commitment_letters&guarantorCode=${selectedGuarantor.personnel_code}`);
                if (!response.ok) throw new Error('Could not fetch credit info');
                const data = await response.json();
                
                const committed = data.totalCommitted || 0;
                const factors = parseFloat(toEnglishDigits(sumOfDecreeFactors).replace(/,/g, '')) || 0;
                const limit = factors * 30;
                const remaining = limit - committed;

                setCreditInfo({ limit, committed, remaining });
            } catch (error) {
                console.error("Failed to fetch credit info:", error);
            } finally {
                setCreditLoading(false);
            }
        };
        fetchCreditInfo();
    }, [selectedGuarantor, sumOfDecreeFactors]);

    const filterPersonnel = (term: string) => {
        if (!term) return [];
        const lowercasedTerm = term.toLowerCase();
        return allPersonnel.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
            p.personnel_code.includes(lowercasedTerm) ||
            (p.national_id && p.national_id.includes(lowercasedTerm))
        ).slice(0, 10);
    };

    const guarantorResults = useMemo(() => filterPersonnel(guarantorSearch), [guarantorSearch, allPersonnel]);

    const handleSelectGuarantor = (person: Personnel) => {
        setSelectedGuarantor(person);
        setGuarantorSearch(`${person.first_name} ${person.last_name}`);
        setSumOfDecreeFactors(person.sum_of_decree_factors || '');
    };
    
    const handleFetchDecreeFactors = () => {
        if (selectedGuarantor) {
            setSumOfDecreeFactors(selectedGuarantor.sum_of_decree_factors || '');
        }
    };
    
    const handleRecipientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setRecipientInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveAndPrint = async () => {
        setStatus({ type: 'info', message: 'در حال ذخیره نامه در بایگانی...' });
        try {
            const payload = {
                recipient_name: `${recipientInfo.firstName} ${recipientInfo.lastName}`,
                recipient_national_id: recipientInfo.nationalId,
                guarantor_personnel_code: selectedGuarantor?.personnel_code,
                guarantor_name: `${selectedGuarantor?.first_name} ${selectedGuarantor?.last_name}`,
                guarantor_national_id: selectedGuarantor?.national_id,
                loan_amount: parseFloat(loanAmount.replace(/,/g, '')) || 0,
                sum_of_decree_factors: parseFloat(sumOfDecreeFactors.replace(/,/g, '')) || 0,
                bank_name: bankName,
                branch_name: branchName,
                reference_number: referenceNumber
            };

            const response = await fetch('/api/personnel?type=commitment_letters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            
            setStatus({ type: 'success', message: 'نامه با موفقیت بایگانی شد. در حال آماده‌سازی برای چاپ...'});
            setTimeout(() => {
                window.print();
                setStatus(null);
            }, 1000);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ذخیره نامه' });
        }
    };

    const isReady = recipientInfo.firstName && recipientInfo.lastName && recipientInfo.nationalId && selectedGuarantor && loanAmount && bankName && branchName;
    const loanAmountNumber = parseFloat(loanAmount.replace(/,/g, '')) || 0;
    const isOverCredit = selectedGuarantor && loanAmountNumber > creditInfo.remaining;
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
             <style>{`@import url('https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@400;700&display=swap'); .printable-letter { font-family: 'Vazirmatn', sans-serif; } .printable-letter h1 { font-family: 'Lalezar', cursive; } @media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; } @page { size: A4; margin: 2cm; } }`}</style>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">صدور نامه تعهد حسابداری</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-lg font-semibold text-gray-700">اطلاعات نامه</h3>
                    <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                        <div><label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-1">نام بانک</label><input type="text" id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" /></div>
                        <div><label htmlFor="branchName" className="block text-sm font-medium text-gray-700 mb-1">نام شعبه</label><input type="text" id="branchName" value={branchName} onChange={e => setBranchName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md" /></div>
                        <div><label htmlFor="loanAmount" className="block text-sm font-medium text-gray-700 mb-1">مبلغ وام (ریال)</label><input type="text" id="loanAmount" value={formatCurrency(loanAmount)} onChange={e => setLoanAmount(e.target.value.replace(/,/g, ''))} className="w-full p-2 border border-gray-300 rounded-md" /></div>
                        <SearchablePersonnelInput label="ضامن" searchTerm={guarantorSearch} setSearchTerm={setGuarantorSearch} results={guarantorResults} onSelect={handleSelectGuarantor} selectedPerson={selectedGuarantor} />
                        <div><h4 className="block text-sm font-medium text-gray-700 mb-2">اطلاعات وام گیرنده (دستی)</h4><div className="space-y-2 p-3 border rounded-md bg-white"><input type="text" name="firstName" value={recipientInfo.firstName} onChange={handleRecipientChange} placeholder="نام" className="w-full p-2 border border-gray-300 rounded-md" /><input type="text" name="lastName" value={recipientInfo.lastName} onChange={handleRecipientChange} placeholder="نام خانوادگی" className="w-full p-2 border border-gray-300 rounded-md" /><input type="text" name="fatherName" value={recipientInfo.fatherName} onChange={handleRecipientChange} placeholder="نام پدر" className="w-full p-2 border border-gray-300 rounded-md" /><input type="text" name="nationalId" value={recipientInfo.nationalId} onChange={handleRecipientChange} placeholder="کد ملی" className="w-full p-2 border border-gray-300 rounded-md" /></div></div>
                    </div>

                    {selectedGuarantor && (
                        <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                             <h4 className="font-semibold text-gray-700">اعتبارسنجی ضامن</h4>
                            {creditLoading ? <p>در حال بررسی...</p> : (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-600">جمع عوامل حکم:</span> <span className="font-bold">{toPersianDigits(formatCurrency(sumOfDecreeFactors))} ریال</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">سقف تعهد (۳۰ برابر):</span> <span className="font-bold">{toPersianDigits(formatCurrency(creditInfo.limit))} ریال</span></div>
                                    <div className="flex justify-between text-yellow-700"><span >تعهدات قبلی:</span> <span className="font-bold">{toPersianDigits(formatCurrency(creditInfo.committed))} ریال</span></div>
                                    <div className="flex justify-between font-bold text-lg text-green-700 border-t pt-2 mt-2"><span >اعتبار باقیمانده:</span> <span>{toPersianDigits(formatCurrency(creditInfo.remaining))} ریال</span></div>
                                </div>
                            )}
                        </div>
                    )}
                    {isOverCredit && <div className="p-3 text-sm font-semibold rounded-lg bg-red-100 text-red-800 text-center">هشدار: مبلغ وام درخواستی از اعتبار باقیمانده ضامن بیشتر است.</div>}

                     <div className="flex items-center gap-2">
                        <button onClick={handleSaveAndPrint} disabled={!isReady || isOverCredit} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">
                            <PrinterIcon className="w-5 h-5" /> ذخیره و چاپ نامه
                        </button>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">پیش نمایش نامه</h3>
                    <div ref={letterRef} className="print-area printable-letter border rounded-lg p-8 min-h-[600px] bg-gray-50/50">
                        <div className="flex justify-between items-start text-sm mb-12"><span>{toPersianDigits(todayPersian)}</span><span>{toPersianDigits(referenceNumber)}</span></div>
                        <div className="text-center space-y-2 mb-10"><h1 className="text-2xl font-bold">ریاست محترم {bankName} {branchName}</h1><p className="text-lg">موضوع: تعهد حسابداری</p></div>
                        <div className="text-justify leading-loose"><p>احتراماً حسابداری این شرکت تعهد می نماید در صورت عدم پرداخت اقساط وام به مبلغ{' '}<span className="font-bold px-1">{toPersianDigits(formatCurrency(loanAmount))}</span>{' '}({numberToPersianWords(loanAmount)}) ریال بنام آقای{' '}<span className="font-bold px-1">{recipientInfo.firstName ? `${recipientInfo.firstName} ${recipientInfo.lastName}` : '...'}</span>{' '}فرزند{' '}<span className="font-bold px-1">{recipientInfo.fatherName || '...'}</span>{' '}با کد ملی{' '}<span className="font-bold px-1">{recipientInfo.nationalId ? toPersianDigits(recipientInfo.nationalId) : '...'}</span>{' '}از حقوق ضامن نامبرده آقای{' '}<span className="font-bold px-1">{selectedGuarantor ? `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}` : '...'}</span>{' '}فرزند{' '}<span className="font-bold px-1">{selectedGuarantor ? selectedGuarantor.father_name : '...'}</span>{' '}با کد پرسنلی{' '}<span className="font-bold px-1">{selectedGuarantor ? toPersianDigits(selectedGuarantor.personnel_code) : '...'}</span>{' '}در این شرکت شاغل باشد بعد از اعلام بانک و با رعایت سقف قانونی کسر و به حساب آن بانک واریز نماید.</p><p className="mt-8">این گواهی بنا به درخواست نامبرده جهت ارائه به بانک فوق صادر گردیده است و فاقد هرگونه ارزش دیگری می باشد.</p></div>
                         <div className="mt-20 text-center"><p className="font-bold">با تشکر</p><p className="font-bold mt-2">مدیریت سرمایه انسانی</p><div className="mt-12 w-48 h-20 border-t mx-auto"></div></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountingCommitmentPage;