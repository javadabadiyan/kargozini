import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Personnel, CommitmentLetter } from '../../types';
import { SearchIcon, UsersIcon, PrinterIcon } from '../icons/Icons';
import CommitmentLetterArchivePage from './CommitmentLetterArchivePage';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

const formatCurrency = (value: string | number): string => {
    if (!value) return '';
    const num = String(value).replace(/,/g, '');
    if (isNaN(Number(num))) return String(value);
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const DEFAULT_LETTER_FORM = {
    recipient_name: '',
    recipient_national_id: '',
    loan_amount: 0,
    bank_name: '',
    branch_name: '',
    reference_number: '',
};

const AccountingCommitmentPage: React.FC = () => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGuarantor, setSelectedGuarantor] = useState<Personnel | null>(null);
    const [guarantorCommitments, setGuarantorCommitments] = useState({ total: 0 });

    const [formData, setFormData] = useState(DEFAULT_LETTER_FORM);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdLetter, setCreatedLetter] = useState<CommitmentLetter | null>(null);
    
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('Failed to fetch personnel');
                const data = await response.json();
                setPersonnelList(data.personnel || []);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Error fetching personnel' });
            } finally {
                setPersonnelLoading(false);
            }
        };
        fetchPersonnel();
    }, []);
    
    const fetchGuarantorCommitments = useCallback(async (personnelCode: string) => {
        try {
            const response = await fetch(`/api/personnel?type=commitment_letters&guarantorCode=${personnelCode}`);
            if (!response.ok) throw new Error('Failed to fetch commitments');
            const data = await response.json();
            setGuarantorCommitments({ total: data.totalCommitted || 0 });
        } catch (err) {
            console.error(err);
            setGuarantorCommitments({ total: 0 });
        }
    }, []);

    useEffect(() => {
        if (selectedGuarantor) {
            fetchGuarantorCommitments(selectedGuarantor.personnel_code);
        } else {
            setGuarantorCommitments({ total: 0 });
        }
    }, [selectedGuarantor, fetchGuarantorCommitments]);

    const filteredPersonnel = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return [];
        return personnelList.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(term) ||
            p.personnel_code.toLowerCase().includes(term)
        ).slice(0, 10);
    }, [searchTerm, personnelList]);
    
    const handleGuarantorSelect = (person: Personnel) => {
        setSelectedGuarantor(person);
        setSearchTerm(`${person.first_name} ${person.last_name}`);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = toEnglishDigits(e.target.value).replace(/,/g, '');
        if (/^\d*$/.test(val)) {
            setFormData(prev => ({ ...prev, loan_amount: Number(val) }));
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGuarantor) {
            setStatus({ type: 'error', message: 'لطفاً یک ضامن انتخاب کنید.' });
            return;
        }
        setIsSubmitting(true);
        setStatus({ type: 'info', message: 'در حال ثبت نامه...' });

        const payload = {
            ...formData,
            guarantor_personnel_code: selectedGuarantor.personnel_code,
            guarantor_name: `${selectedGuarantor.first_name} ${selectedGuarantor.last_name}`,
            guarantor_national_id: selectedGuarantor.national_id,
            sum_of_decree_factors: Number(selectedGuarantor.sum_of_decree_factors) || null,
        };

        try {
            const response = await fetch('/api/personnel?type=commitment_letters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            
            setStatus({ type: 'success', message: 'نامه تعهد با موفقیت صادر شد.' });
            setCreatedLetter(data.letter);

        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت نامه' });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const handlePrint = () => {
        const printContent = printRef.current?.innerHTML;
        if (printContent) {
            const originalContent = document.body.innerHTML;
            document.body.innerHTML = printContent;
            window.print();
            document.body.innerHTML = originalContent;
            window.location.reload(); // To re-attach React
        }
    };
    
    const resetForm = () => {
        setCreatedLetter(null);
        setSelectedGuarantor(null);
        setSearchTerm('');
        setFormData(DEFAULT_LETTER_FORM);
    };

    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    if (createdLetter) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <style>{`@media print { body * { visibility: hidden; } #print-section, #print-section * { visibility: visible; } #print-section { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">پیش‌نمایش نامه تعهد</h2>
                    <div>
                        <button onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 ml-2">صدور نامه جدید</button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                           <PrinterIcon className="w-5 h-5"/> چاپ
                        </button>
                    </div>
                </div>
                 <div ref={printRef} id="print-section" className="p-8 border rounded-lg bg-slate-50 leading-loose text-gray-800" dir="rtl">
                    <h3 className="text-center font-bold text-lg mb-8">گواهی کسر از حقوق</h3>
                    <p className="mb-4"><strong>امور مالی محترم بانک {createdLetter.bank_name} شعبه {createdLetter.branch_name}</strong></p>
                    <p className="mb-4">بدینوسیله گواهی می‌شود، آقای/خانم <strong>{createdLetter.guarantor_name}</strong> فرزند {selectedGuarantor?.father_name} به شماره شناسنامه {toPersianDigits(selectedGuarantor?.id_number)} و کد ملی {toPersianDigits(selectedGuarantor?.national_id)} کارمند رسمی این شرکت بوده و ماهانه مبلغ <strong>{toPersianDigits(formatCurrency(createdLetter.sum_of_decree_factors || 0))} ریال</strong> حقوق و مزایا دریافت می‌دارد.</p>
                    <p className="mb-4">این گواهی بنا به درخواست نامبرده جهت ضمانت وام آقای/خانم <strong>{createdLetter.recipient_name}</strong> به کد ملی {toPersianDigits(createdLetter.recipient_national_id)} به مبلغ <strong>{toPersianDigits(formatCurrency(createdLetter.loan_amount))} ریال</strong> صادر گردیده است. این شرکت تعهد می‌نماید در صورت عدم پرداخت اقساط توسط وام گیرنده، پس از اعلام کتبی آن بانک، اقساط معوقه را از حقوق و مزایای ضامن کسر و به حساب آن بانک واریز نماید.</p>
                    <p className="mb-8">این گواهی صرفاً جهت اطلاع بانک صادر گردیده و فاقد هرگونه ارزش و اعتبار دیگری می‌باشد.</p>
                    <div className="flex justify-around items-end pt-12">
                        <p><strong>امور اداری و منابع انسانی</strong></p>
                        <p><strong>امور مالی</strong></p>
                    </div>
                 </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-100 pb-4">صدور نامه تعهد حسابداری</h2>
            {status && <div className={`p-4 mb-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                    <h3 className="text-lg font-bold">۱. اطلاعات ضامن</h3>
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">جستجو و انتخاب ضامن</label>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="نام یا کد پرسنلی ضامن..." className="w-full pr-10 pl-4 py-2 border rounded-md" />
                        <SearchIcon className="absolute right-3 top-9 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        {filteredPersonnel.length > 0 && searchTerm && (
                            <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                {filteredPersonnel.map(p => <li key={p.id} onClick={() => handleGuarantorSelect(p)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">{p.first_name} {p.last_name} ({toPersianDigits(p.personnel_code)})</li>)}
                            </ul>
                        )}
                    </div>
                    {selectedGuarantor && (
                        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-md text-blue-800 space-y-2">
                            <p><strong>نام:</strong> {selectedGuarantor.first_name} {selectedGuarantor.last_name}</p>
                            <p><strong>کد پرسنلی:</strong> {toPersianDigits(selectedGuarantor.personnel_code)}</p>
                            <p><strong>جمع عوامل حکمی:</strong> {toPersianDigits(formatCurrency(selectedGuarantor.sum_of_decree_factors || '0'))} ریال</p>
                             <p className="font-bold"><strong>جمع تعهدات قبلی:</strong> {toPersianDigits(formatCurrency(guarantorCommitments.total))} ریال</p>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                     <h3 className="text-lg font-bold">۲. اطلاعات وام و وام گیرنده</h3>
                     <form onSubmit={handleSubmit} className="space-y-4">
                        <div><label className="text-sm">نام وام گیرنده</label><input type="text" name="recipient_name" value={formData.recipient_name} onChange={handleFormChange} className="w-full p-2 border rounded-md" required/></div>
                        <div><label className="text-sm">کد ملی وام گیرنده</label><input type="text" name="recipient_national_id" value={formData.recipient_national_id} onChange={handleFormChange} className="w-full p-2 border rounded-md" required/></div>
                        <div><label className="text-sm">مبلغ وام (ریال)</label><input type="text" name="loan_amount" value={toPersianDigits(formatCurrency(formData.loan_amount))} onChange={handleAmountChange} className="w-full p-2 border rounded-md" required/></div>
                        <div><label className="text-sm">نام بانک</label><input type="text" name="bank_name" value={formData.bank_name} onChange={handleFormChange} className="w-full p-2 border rounded-md" required/></div>
                        <div><label className="text-sm">نام شعبه</label><input type="text" name="branch_name" value={formData.branch_name} onChange={handleFormChange} className="w-full p-2 border rounded-md" required/></div>
                        <div><label className="text-sm">شماره نامه ارجاع بانک (اختیاری)</label><input type="text" name="reference_number" value={formData.reference_number} onChange={handleFormChange} className="w-full p-2 border rounded-md"/></div>
                        <button type="submit" disabled={!selectedGuarantor || isSubmitting} className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                            {isSubmitting ? 'در حال ثبت...' : 'صدور و ثبت نامه'}
                        </button>
                     </form>
                </div>
            </div>
             <div className="mt-8">
                <CommitmentLetterArchivePage />
            </div>
        </div>
    );
};

export default AccountingCommitmentPage;
