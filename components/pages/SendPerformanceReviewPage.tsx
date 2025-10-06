







import React, { useState, useMemo, useEffect } from 'react';
import type { PerformanceReview, Personnel } from '../../types';
import { DocumentReportIcon } from '../icons/Icons';
import { performanceReviewConfig } from '../performanceReviewConfig';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

const initialFormData = {
    scores_functional: {} as { [key: string]: number },
    scores_behavioral: {} as { [key: string]: number },
    scores_ethical: {} as { [key: string]: number },
    reviewer_comment: '',
    strengths: '',
    weaknesses_and_improvements: '',
    supervisor_suggestions: '',
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
        return uniqueDepartments.sort((a: string, b: string) => a.localeCompare(b, 'fa'));
    }, [personnelList]);

    const personnelInDepartment = useMemo(() => {
        if (!personnelInfo.department) return [];
        return personnelList
            .filter(p => p.department === personnelInfo.department)
            .sort((a,b) => a.last_name.localeCompare(b.last_name, 'fa'));
    }, [personnelList, personnelInfo.department]);

    useEffect(() => {
        if (personnelInfo.fullName) {
            const selected = personnelList.find(p => `${p.first_name} ${p.last_name}` === personnelInfo.fullName);
            if (selected) {
                setPersonnelInfo(prev => ({
                    ...prev,
                    personnelCode: selected.personnel_code,
                }));
            }
        } else {
             setPersonnelInfo(prev => ({ ...prev, personnelCode: '' }));
        }
    }, [personnelInfo.fullName, personnelList]);


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
        if (name === 'department') {
            setPersonnelInfo({ department: value, fullName: '', personnelCode: '' });
        } else {
            setPersonnelInfo(prev => ({ ...prev, [name]: value }));
        }
    };

    const totals = useMemo(() => {
        // FIX: Operator '+' cannot be applied to types 'unknown' and 'number'.
        // Added initial value '0' to reduce() to correctly type the accumulator as a number.
        // Also ensured values are treated as numbers.
        const total_score_functional = Object.values(formData.scores_functional).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const total_score_behavioral = Object.values(formData.scores_behavioral).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const total_score_ethical = Object.values(formData.scores_ethical).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const overall_score = total_score_functional + total_score_behavioral + total_score_ethical;
        return { total_score_functional, total_score_behavioral, total_score_ethical, overall_score };
    }, [formData.scores_functional, formData.scores_behavioral, formData.scores_ethical]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const fieldsToValidate = [
            { value: personnelInfo.fullName, label: 'نام و نام خانوادگی' },
            { value: personnelInfo.personnelCode, label: 'کد پرسنلی' },
            { value: personnelInfo.department, label: 'واحد' },
            { value: evaluationYear, label: 'سال ارزیابی' },
            { value: formData.reviewer_comment, label: 'نظر ارزیابی شونده' },
            { value: formData.strengths, label: 'نقاط قوت' },
            { value: formData.weaknesses_and_improvements, label: 'نقاط ضعف و بهبود' },
            { value: formData.supervisor_suggestions, label: 'پیشنهادات سرپرست' },
        ];

        for (const field of fieldsToValidate) {
            if (!field.value || String(field.value).trim() === '') {
                setStatus({ type: 'error', message: `لطفاً فیلد "${field.label}" را تکمیل کنید.` });
                return;
            }
        }
        
        const scoringSections = [
            { answered: Object.keys(formData.scores_functional).length, total: performanceReviewConfig.functional.length, name: 'عوامل عملکردی' },
            { answered: Object.keys(formData.scores_behavioral).length, total: performanceReviewConfig.behavioral.length, name: 'معیارهای رفتاری' },
            { answered: Object.keys(formData.scores_ethical).length, total: performanceReviewConfig.ethical.length, name: 'معیارهای اخلاقی' },
        ];

        for (const section of scoringSections) {
            if (section.answered < section.total) {
                setStatus({ type: 'error', message: `لطفاً به تمام سوالات بخش "${section.name}" پاسخ دهید (${toPersianDigits(section.answered)} از ${toPersianDigits(section.total)}).` });
                return;
            }
        }

        setIsSubmitting(true);
        setStatus({ type: 'info', message: 'در حال ثبت ارزیابی...' });

        const payload = {
            ...formData,
            ...totals,
            personnel_code: personnelInfo.personnelCode,
            department: personnelInfo.department,
            submitted_by_user: currentUser.full_name || currentUser.username,
            review_period_start: `${evaluationYear}/01/01`,
            review_period_end: `${evaluationYear}/12/29`,
            reviewer_name_and_signature: currentUser.full_name || currentUser.username,
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
                                        required
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
        <div className="bg-white dark:bg-slate-800/80 p-6 rounded-xl shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b-2 border-slate-200/50 dark:border-slate-700/50 pb-4">
                <DocumentReportIcon className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">ارسال ارزیابی عملکرد پرسنل</h2>
            </div>
            {status && <div className={`p-4 text-sm rounded-lg ${statusColor[status.type]}`}>{status.message}</div>}

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-700/50 space-y-4">
                    <h3 className="font-bold text-lg">۱. اطلاعات پرسنل و دوره ارزیابی</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">واحد</label>
                            <select name="department" value={personnelInfo.department} onChange={handlePersonnelInfoChange} className="w-full p-2 border rounded-md" required>
                                <option value="">انتخاب واحد...</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">نام و نام خانوادگی</label>
                            <select name="fullName" value={personnelInfo.fullName} onChange={handlePersonnelInfoChange} className="w-full p-2 border rounded-md" disabled={!personnelInfo.department || personnelInDepartment.length === 0} required>
                                <option value="">انتخاب پرسنل...</option>
                                {personnelInDepartment.map(p => <option key={p.id} value={`${p.first_name} ${p.last_name}`}>{p.first_name} {p.last_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">کد پرسنلی</label>
                            <input type="text" name="personnelCode" value={toPersianDigits(personnelInfo.personnelCode)} className="w-full p-2 border rounded-md bg-slate-200 dark:bg-slate-600" readOnly />
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">سال ارزیابی</label>
                            <input type="text" value={toPersianDigits(evaluationYear)} onChange={e => setEvaluationYear(e.target.value)} className="w-full p-2 border rounded-md" required />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="font-bold text-lg">۲. ارزیابی عملکرد</h3>
                    <ScoringTable title="عوامل عملکردی (جمع امتیازات: ۵۰)" config={performanceReviewConfig.functional} category="functional" maxScore={50} currentScore={totals.total_score_functional} />
                    <ScoringTable title="معیارهای رفتاری (جمع امتیازات: ۴۰)" config={performanceReviewConfig.behavioral} category="behavioral" maxScore={40} currentScore={totals.total_score_behavioral} />
                    <ScoringTable title="معیارهای اخلاقی (جمع امتیازات: ۱۰)" config={performanceReviewConfig.ethical} category="ethical" maxScore={10} currentScore={totals.total_score_ethical} />
                </div>
                
                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/50 text-center">
                    <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200">امتیاز کل: {toPersianDigits(totals.overall_score)}</h3>
                </div>

                <div className="space-y-6">
                    <h3 className="font-bold text-lg">۳. جمع بندی و پیشنهادات</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">نقاط قوت</label>
                            <textarea name="strengths" value={formData.strengths} onChange={handleTextChange} rows={4} className="w-full p-2 border rounded-md" required />
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">نقاط ضعف و موارد قابل بهبود</label>
                            <textarea name="weaknesses_and_improvements" value={formData.weaknesses_and_improvements} onChange={handleTextChange} rows={4} className="w-full p-2 border rounded-md" required />
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">نظر ارزیابی شونده</label>
                        <textarea name="reviewer_comment" value={formData.reviewer_comment} onChange={handleTextChange} rows={3} className="w-full p-2 border rounded-md" required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium mb-1">پیشنهادات سرپرست مستقیم جهت بهبود عملکرد</label>
                        <textarea name="supervisor_suggestions" value={formData.supervisor_suggestions} onChange={handleTextChange} rows={3} className="w-full p-2 border rounded-md" required />
                    </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full py-3 text-lg font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                    {isSubmitting ? 'در حال ارسال...' : 'ثبت و ارسال نهایی ارزیابی'}
                </button>
            </form>
        </div>
    );
};

export default SendPerformanceReviewPage;