import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Personnel, PerformanceReview } from '../../types';
import { SearchIcon, UserIcon, DocumentReportIcon } from '../icons/Icons';
import { performanceReviewConfig } from '../performanceReviewConfig';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const initialFormData = {
    review_period_start: '۱۴۰۱/۰۱/۰۱',
    review_period_end: '۱۴۰۱/۱۲/۲۹',
    scores_functional: {},
    scores_behavioral: {},
    scores_ethical: {},
    reviewer_comment: '',
    strengths: '',
    weaknesses_and_improvements: '',
    supervisor_suggestions: '',
    reviewer_name_and_signature: '',
    supervisor_signature: '',
    manager_signature: '',
};

const SendPerformanceReviewPage: React.FC = () => {
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [formData, setFormData] = useState<Omit<PerformanceReview, 'id' | 'personnel_code' | 'review_date' | 'total_score_functional' | 'total_score_behavioral' | 'total_score_ethical' | 'overall_score'>>(initialFormData);
    
    useEffect(() => {
        const fetchPersonnel = async () => {
            setPersonnelLoading(true);
            try {
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('Failed to fetch personnel');
                const data = await response.json();
                setPersonnelList(data.personnel || []);
            } catch (err) {
                setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
            } finally {
                setPersonnelLoading(false);
            }
        };
        fetchPersonnel();
    }, []);

    const filteredPersonnel = useMemo(() => {
        if (!searchTerm) return [];
        const lowercasedTerm = searchTerm.toLowerCase().trim();
        return personnelList.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(lowercasedTerm) ||
            p.personnel_code.toLowerCase().includes(lowercasedTerm)
        ).slice(0, 10);
    }, [personnelList, searchTerm]);
    
    const handleSelectPersonnel = (person: Personnel) => {
        setSelectedPersonnel(person);
        setSearchTerm('');
        setFormData(initialFormData);
        setStatus(null);
    };

    const handleScoreChange = (category: 'functional' | 'behavioral' | 'ethical', key: string, value: number) => {
        setFormData(prev => ({
            ...prev,
            [`scores_${category}`]: {
                ...prev[`scores_${category}`],
                [key]: value
            }
        }));
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const totals = useMemo(() => {
        const total_score_functional = Object.values(formData.scores_functional).reduce((sum, val) => sum + val, 0);
        const total_score_behavioral = Object.values(formData.scores_behavioral).reduce((sum, val) => sum + val, 0);
        const total_score_ethical = Object.values(formData.scores_ethical).reduce((sum, val) => sum + val, 0);
        const overall_score = total_score_functional + total_score_behavioral + total_score_ethical;
        return { total_score_functional, total_score_behavioral, total_score_ethical, overall_score };
    }, [formData.scores_functional, formData.scores_behavioral, formData.scores_ethical]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPersonnel) {
            setStatus({ type: 'error', message: 'لطفاً یک پرسنل را انتخاب کنید.' });
            return;
        }
        setIsSubmitting(true);
        setStatus({ type: 'info', message: 'در حال ثبت ارزیابی...' });

        const payload = {
            ...formData,
            ...totals,
            personnel_code: selectedPersonnel.personnel_code,
        };

        try {
            const response = await fetch('/api/personnel?type=performance_reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setStatus({ type: 'success', message: 'ارزیابی با موفقیت ثبت شد و به بایگانی ارسال گردید.' });
            setFormData(initialFormData);
            setSelectedPersonnel(null);
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت ارزیابی' });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const ScoringTable: React.FC<{
        title: string;
        config: { id: string; label: string; description: string; scores: { label: string; value: number }[] }[];
        category: 'functional' | 'behavioral' | 'ethical';
        maxScore: number;
        currentScore: number;
    }> = ({ title, config, category, maxScore, currentScore }) => (
        <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th className="p-2 text-right font-semibold" colSpan={2}>{title}</th>
                        <th className="p-2 text-center font-semibold" colSpan={config[0].scores.length}>سطوح عملکرد و ارزش عددی مربوط</th>
                    </tr>
                    <tr>
                        <th className="p-2 text-right font-semibold">ردیف</th>
                        <th className="p-2 text-right font-semibold">عوامل مورد بررسی</th>
                        {config[0].scores.map(score => (
                            <th key={score.value} className="p-2 text-center font-semibold whitespace-nowrap">{score.label}<br/>({toPersianDigits(score.value)})</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {config.map((item, index) => (
                        <tr key={item.id}>
                            <td className="p-2 text-center">{toPersianDigits(index + 1)}</td>
                            <td className="p-2">
                                <p className="font-semibold">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.description}</p>
                            </td>
                            {item.scores.map(score => (
                                <td key={score.value} className="p-2 text-center align-middle">
                                    <input
                                        type="radio"
                                        name={item.id}
                                        value={score.value}
                                        checked={formData[`scores_${category}`][item.id] === score.value}
                                        onChange={() => handleScoreChange(category, item.id, score.value)}
                                        className="w-5 h-5 accent-blue-600"
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                    <tr className="font-bold bg-slate-100 dark:bg-slate-700">
                        <td className="p-3" colSpan={2}>جمع امتیازات</td>
                        <td className="p-3 text-center" colSpan={config[0].scores.length}>
                            {toPersianDigits(currentScore)} از {toPersianDigits(maxScore)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
    
    const statusColor = { info: 'bg-blue-100 text-blue-800', success: 'bg-green-100 text-green-800', error: 'bg-red-100 text-red-800' };

    return (
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-xl shadow-xl space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <div className="flex items-center gap-3">
                    <DocumentReportIcon className="w-8 h-8 text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">ارسال فرم ارزیابی عملکرد سالانه کارکنان</h2>
                </div>
            </div>
            
            {status && <div className={`p-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            {!selectedPersonnel ? (
                <div className="bg-slate-50 dark:bg-slate-700/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                    <label htmlFor="search-personnel" className="block text-lg font-semibold text-gray-700 dark:text-slate-200 mb-3">۱. ابتدا پرسنل مورد نظر را انتخاب کنید</label>
                    <div className="relative">
                        <input type="text" id="search-personnel" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:w-1/2 p-2 border border-slate-300 dark:border-slate-600 rounded-md" placeholder="جستجوی نام یا کد پرسنلی..." />
                        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                     {filteredPersonnel.length > 0 && (
                        <ul className="mt-2 border rounded-md bg-white dark:bg-slate-800 max-h-60 overflow-y-auto w-full md:w-1/2">
                            {filteredPersonnel.map(p => (
                                <li key={p.id} onClick={() => handleSelectPersonnel(p)} className="flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm">
                                    <UserIcon className="w-5 h-5 text-slate-400"/>
                                    <div>
                                        <p className="font-semibold">{p.first_name} {p.last_name}</p>
                                        <p className="text-xs text-slate-500">کد: {toPersianDigits(p.personnel_code)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50">
                        <div className="flex justify-between items-start">
                             <h3 className="text-lg font-bold mb-4">اطلاعات پرسنل</h3>
                             <button type="button" onClick={() => setSelectedPersonnel(null)} className="text-sm text-red-600 hover:underline">تغییر پرسنل</button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <p><strong>نام:</strong> {selectedPersonnel.first_name} {selectedPersonnel.last_name}</p>
                            <p><strong>نام پدر:</strong> {selectedPersonnel.father_name}</p>
                            <p><strong>کد پرسنلی:</strong> {toPersianDigits(selectedPersonnel.personnel_code)}</p>
                            <p><strong>مدرک تحصیلی:</strong> {selectedPersonnel.education_level}</p>
                            <p><strong>عنوان شغل:</strong> {selectedPersonnel.job_title}</p>
                            <p><strong>محل خدمت:</strong> {selectedPersonnel.service_location}</p>
                            <div>
                                <label className="font-bold">دوره ارزیابی از: </label>
                                <input name="review_period_start" value={formData.review_period_start} onChange={handleTextChange} className="p-1 border rounded-md bg-white dark:bg-slate-600 w-28"/>
                            </div>
                             <div>
                                <label className="font-bold">تا: </label>
                                <input name="review_period_end" value={formData.review_period_end} onChange={handleTextChange} className="p-1 border rounded-md bg-white dark:bg-slate-600 w-28"/>
                            </div>
                        </div>
                    </div>

                    <ScoringTable title="عوامل عملکردی" config={performanceReviewConfig.functional} category="functional" maxScore={50} currentScore={totals.total_score_functional} />
                    <ScoringTable title="معیارهای رفتاری" config={performanceReviewConfig.behavioral} category="behavioral" maxScore={40} currentScore={totals.total_score_behavioral} />
                    <ScoringTable title="معیارهای اخلاقی" config={performanceReviewConfig.ethical} category="ethical" maxScore={10} currentScore={totals.total_score_ethical} />
                    
                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50">
                        <h3 className="text-lg font-bold mb-4">جمع بندی امتیازات</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-3 bg-white dark:bg-slate-600 rounded-lg shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-slate-300">امتیاز عملکردی</p>
                                <p className="text-2xl font-bold">{toPersianDigits(totals.total_score_functional)}</p>
                            </div>
                             <div className="p-3 bg-white dark:bg-slate-600 rounded-lg shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-slate-300">امتیاز رفتاری</p>
                                <p className="text-2xl font-bold">{toPersianDigits(totals.total_score_behavioral)}</p>
                            </div>
                             <div className="p-3 bg-white dark:bg-slate-600 rounded-lg shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-slate-300">امتیاز اخلاقی</p>
                                <p className="text-2xl font-bold">{toPersianDigits(totals.total_score_ethical)}</p>
                            </div>
                             <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-lg shadow-sm ring-2 ring-blue-500">
                                <p className="text-sm text-blue-800 dark:text-blue-300">امتیاز کل</p>
                                <p className="text-2xl font-bold text-blue-900 dark:text-blue-200">{toPersianDigits(totals.overall_score)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="font-semibold block mb-1">نظر ارزیابی شونده (در صورت نیاز / کسب امتیاز کمتر از ۵۰):</label>
                            <textarea name="reviewer_comment" value={formData.reviewer_comment} onChange={handleTextChange} className="w-full p-2 border rounded-md min-h-[100px] bg-slate-50 dark:bg-slate-700/50"></textarea>
                        </div>
                        <div>
                            <label className="font-semibold block mb-1">خلاصه مطالب مورد مذاکره در جلسه گفت و گو با مصاحبه پایان دوره:</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold block mb-1">نقاط قوت عملکرد و شیوه های تقویت آن:</label>
                                    <textarea name="strengths" value={formData.strengths} onChange={handleTextChange} className="w-full p-2 border rounded-md min-h-[120px] bg-slate-50 dark:bg-slate-700/50"></textarea>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold block mb-1">نقاط ضعف عملکرد و راههای اصلاح و بهبود آن:</label>
                                    <textarea name="weaknesses_and_improvements" value={formData.weaknesses_and_improvements} onChange={handleTextChange} className="w-full p-2 border rounded-md min-h-[120px] bg-slate-50 dark:bg-slate-700/50"></textarea>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="font-semibold block mb-1">پیشنهادات سرپرست مستقیم در مورد همکار با توجه به نتیجه ارزشیابی و رعایت مقررات مربوط و ذکر آموزش های مورد نیاز در این خصوص:</label>
                            <textarea name="supervisor_suggestions" value={formData.supervisor_suggestions} onChange={handleTextChange} className="w-full p-2 border rounded-md min-h-[100px] bg-slate-50 dark:bg-slate-700/50"></textarea>
                        </div>
                    </div>
                    
                    <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50">
                        <h3 className="text-lg font-bold mb-4">تایید و امضاء</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="text-sm">ارزیابی کننده (مسئول مستقیم):</label><input name="reviewer_name_and_signature" value={formData.reviewer_name_and_signature} onChange={handleTextChange} className="w-full p-2 border rounded-md mt-1" /></div>
                            <div><label className="text-sm">تایید کننده (سرپرست مستقیم):</label><input name="supervisor_signature" value={formData.supervisor_signature} onChange={handleTextChange} className="w-full p-2 border rounded-md mt-1" /></div>
                            <div><label className="text-sm">تایید کننده نهایی (مدیر عامل):</label><input name="manager_signature" value={formData.manager_signature} onChange={handleTextChange} className="w-full p-2 border rounded-md mt-1" /></div>
                         </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400" disabled={isSubmitting}>
                            {isSubmitting ? 'در حال ثبت...' : 'ثبت نهایی و ارسال به بایگانی'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default SendPerformanceReviewPage;
