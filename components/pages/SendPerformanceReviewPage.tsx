import React, { useState, useMemo, useEffect } from 'react';
import type { PerformanceReview, Personnel } from '../../types';
import { DocumentReportIcon } from '../icons/Icons';
import { performanceReviewConfig } from '../performanceReviewConfig';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const initialFormData = {
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

const initialPersonnelInfo = {
    fullName: '',
    personnelCode: '',
    department: '',
};

const getCurrentPersianYear = () => {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        timeZone: 'Asia/Tehran',
    }).format(new Date());
};

const SendPerformanceReviewPage: React.FC = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ type: 'info' | 'success' | 'error'; message: string } | null>(null);
    const [formData, setFormData] = useState<Omit<PerformanceReview, 'id' | 'personnel_code' | 'review_date' | 'review_period_start' | 'review_period_end' | 'total_score_functional' | 'total_score_behavioral' | 'total_score_ethical' | 'overall_score'>>(initialFormData);
    const [personnelInfo, setPersonnelInfo] = useState(initialPersonnelInfo);
    const [evaluationYear, setEvaluationYear] = useState('');
    
    const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const currentUser = useMemo(() => JSON.parse(sessionStorage.getItem('currentUser') || '{}'), []);

    useEffect(() => {
        setEvaluationYear(getCurrentPersianYear());
        
        const fetchPersonnel = async () => {
            setPersonnelLoading(true);
            try {
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) throw new Error('Failed to fetch personnel list');
                const data = await response.json();
                setPersonnelList(data.personnel || []);
            } catch (err) {
                 setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Could not load personnel list' });
            } finally {
                setPersonnelLoading(false);
            }
        };
        fetchPersonnel();
    }, []);

    const departments = useMemo(() => {
        const uniqueDepartments = [...new Set(personnelList.map(p => p.department).filter(Boolean))];
        // FIX: Added explicit types to sort callback arguments to resolve 'localeCompare does not exist on type unknown' error.
        return uniqueDepartments.sort((a: string, b: string) => a.localeCompare(b, 'fa'));
    }, [personnelList]);


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
    
    const handlePersonnelInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setPersonnelInfo(prev => ({ ...prev, [name]: value }));
    };

    const totals = useMemo(() => {
        // FIX: Added explicit types to reduce callback arguments to resolve "Operator '+' cannot be applied to types 'unknown' and 'unknown'".
        const total_score_functional = Object.values(formData.scores_functional).reduce((sum: number, val: number) => sum + val, 0);
        const total_score_behavioral = Object.values(formData.scores_behavioral).reduce((sum: number, val: number) => sum + val, 0);
        const total_score_ethical = Object.values(formData.scores_ethical).reduce((sum: number, val: number) => sum + val, 0);
        const overall_score = total_score_functional + total_score_behavioral + total_score_ethical;
        return { total_score_functional, total_score_behavioral, total_score_ethical, overall_score };
    }, [formData.scores_functional, formData.scores_behavioral, formData.scores_ethical]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!personnelInfo.personnelCode || !personnelInfo.fullName) {
            setStatus({ type: 'error', message: 'لطفاً نام کامل و کد پرسنلی را وارد کنید.' });
            return;
        }
        if (!evaluationYear) {
            setStatus({ type: 'error', message: 'لطفاً سال ارزیابی را مشخص کنید.' });
            return;
        }

        setIsSubmitting(true);
        setStatus({ type: 'info', message: 'در حال ثبت ارزیابی...' });

        const payload = {
            ...formData,
            ...totals,
            personnel_code: personnelInfo.personnelCode,
            department: personnelInfo.department,
            submitted_by_user: currentUser.full_name || currentUser.username,
            review_period_start: `${evaluationYear}/۰۱/۰۱`,
            review_period_end: `${evaluationYear}/۱۲/۲۹`,
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
            setPersonnelInfo(initialPersonnelInfo);
            setEvaluationYear(getCurrentPersianYear());
        } catch (err) {
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'خطا در ثبت ارزیابی. ممکن است کد پرسنلی نامعتبر باشد.' });
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

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-700/50">
                    <h3 className="text-lg font-bold mb-4">۱. اطلاعات پرسنل و دوره</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="font-semibold block mb-1 text-sm text-slate-700 dark:text-slate-200">نام و نام خانوادگی:</label>
                            <input name="fullName" value={personnelInfo.fullName} onChange={handlePersonnelInfoChange} className="w-full p-2 border rounded-md bg-white dark:bg-slate-600" required />
                        </div>
                        <div>
                            <label className="font-semibold block mb-1 text-sm text-slate-700 dark:text-slate-200">کد پرسنلی:</label>
                            <input name="personnelCode" value={personnelInfo.personnelCode} onChange={handlePersonnelInfoChange} className="w-full p-2 border rounded-md bg-white dark:bg-slate-600" required />
                        </div>
                        <div>
                            <label className="font-semibold block mb-1 text-sm text-slate-700 dark:text-slate-200">واحد:</label>
                            <select name="department" value={personnelInfo.department} onChange={handlePersonnelInfoChange} className="w-full p-2 border rounded-md bg-white dark:bg-slate-600" disabled={personnelLoading}>
                                <option value="">انتخاب واحد</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="font-semibold block mb-1 text-sm text-slate-700 dark:text-slate-200">سال ارزیابی:</label>
                            <input name="evaluationYear" value={toPersianDigits(evaluationYear)} onChange={(e) => setEvaluationYear(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-slate-600" required />
                        </div>
                        <div>
                            <label className="font-semibold block mb-1 text-sm text-slate-700 dark:text-slate-200">تکمیل کننده فرم:</label>
                            <input value={currentUser.full_name || currentUser.username} className="w-full p-2 border rounded-md bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300" readOnly />
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
        </div>
    );
};

export default SendPerformanceReviewPage;