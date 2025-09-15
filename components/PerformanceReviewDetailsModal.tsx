import React, { useRef } from 'react';
import type { PerformanceReview } from '../types';
import { performanceReviewConfig } from './performanceReviewConfig';
import { PrinterIcon } from './icons/Icons';

const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

interface PerformanceReviewDetailsModalProps {
    review: PerformanceReview;
    onClose: () => void;
}

const PerformanceReviewDetailsModal: React.FC<PerformanceReviewDetailsModalProps> = ({ review, onClose }) => {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = printRef.current?.innerHTML;
        if (printContent) {
            const printWindow = window.open('', '', 'height=800,width=1200');
            if(printWindow) {
                printWindow.document.write('<html><head><title>چاپ ارزیابی</title>');
                printWindow.document.write('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap" rel="stylesheet">');
                printWindow.document.write('<style>body{font-family:"Vazirmatn",sans-serif;direction:rtl;margin:20px;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ccc;padding:8px;text-align:right;} th{background-color:#f2f2f2;} h3,h4{margin-top:20px;margin-bottom:10px;border-bottom:1px solid #eee;padding-bottom:5px;} .no-border{border:none !important;} .text-center{text-align:center;} .grid-container{display:grid;grid-template-columns:1fr 1fr;gap:20px;} .print-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px;} .font-bold{font-weight:700;} </style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(printContent);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
        }
    };
    
    const ReadOnlyScoringTable: React.FC<{
        title: string;
        config: { id: string; label: string; description: string; scores: { label: string; value: number }[] }[];
        scoresData: { [key: string]: number };
        total: number;
        maxScore: number;
    }> = ({ title, config, scoresData, total, maxScore }) => (
         <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr><th className="p-2 text-right font-semibold" colSpan={config[0].scores.length + 2}>{title}</th></tr>
                    <tr>
                        <th className="p-2 text-right font-semibold">ردیف</th>
                        <th className="p-2 text-right font-semibold">عوامل مورد بررسی</th>
                        {config[0].scores.map(score => <th key={score.value} className="p-2 text-center font-semibold">{toPersianDigits(score.value)}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {config.map((item, index) => (
                        <tr key={item.id}>
                            <td className="p-2 text-center">{toPersianDigits(index + 1)}</td>
                            <td className="p-2">{item.label}</td>
                            {item.scores.map(score => (
                                <td key={score.value} className="p-2 text-center align-middle">
                                    {scoresData[item.id] === score.value ? '✔' : ''}
                                </td>
                            ))}
                        </tr>
                    ))}
                    <tr className="font-bold bg-slate-100 dark:bg-slate-700"><td className="p-3" colSpan={2}>جمع امتیازات</td><td className="p-3 text-center" colSpan={config[0].scores.length}>{toPersianDigits(total)} از {toPersianDigits(maxScore)}</td></tr>
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-slate-700">
                    <h3 className="text-xl font-semibold">جزئیات ارزیابی عملکرد: {review.full_name}</h3>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><PrinterIcon className="w-5 h-5"/> چاپ</button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">&times;</button>
                    </div>
                </div>
                <div className="overflow-y-auto p-6" ref={printRef}>
                    <div className="print-header">
                        <h3 className="text-2xl font-bold">فرم ارزیابی عملکرد سالانه کارکنان</h3>
                        <div>
                            <p><strong>کد فرم:</strong> FO-HC-030</p>
                            <p><strong>تاریخ ثبت:</strong> {toPersianDigits(new Date(review.review_date).toLocaleDateString('fa-IR'))}</p>
                        </div>
                    </div>

                    <table className="w-full mb-4 text-sm">
                        <tbody>
                            <tr>
                                <td className="p-2 font-bold">نام:</td><td className="p-2">{review.full_name}</td>
                                <td className="p-2 font-bold">کد پرسنلی:</td><td className="p-2">{toPersianDigits(review.personnel_code)}</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-bold">دوره ارزیابی:</td><td className="p-2" colSpan={3}>از {toPersianDigits(review.review_period_start)} تا {toPersianDigits(review.review_period_end)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="space-y-6">
                        <ReadOnlyScoringTable title="عوامل عملکردی" config={performanceReviewConfig.functional} scoresData={review.scores_functional} total={review.total_score_functional} maxScore={50} />
                        <ReadOnlyScoringTable title="معیارهای رفتاری" config={performanceReviewConfig.behavioral} scoresData={review.scores_behavioral} total={review.total_score_behavioral} maxScore={40} />
                        <ReadOnlyScoringTable title="معیارهای اخلاقی" config={performanceReviewConfig.ethical} scoresData={review.scores_ethical} total={review.total_score_ethical} maxScore={10} />
                    </div>
                    
                    <div className="mt-6">
                        <h4 className="text-lg font-bold">جمع بندی امتیازات کل: {toPersianDigits(review.overall_score)}</h4>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div><h4>نظر ارزیابی شونده:</h4><p className="p-2 border rounded-md bg-slate-50 min-h-[50px]">{review.reviewer_comment || '-'}</p></div>
                        <div className="grid-container">
                            <div><h4>نقاط قوت:</h4><p className="p-2 border rounded-md bg-slate-50 min-h-[80px]">{review.strengths || '-'}</p></div>
                            <div><h4>نقاط ضعف و بهبود:</h4><p className="p-2 border rounded-md bg-slate-50 min-h-[80px]">{review.weaknesses_and_improvements || '-'}</p></div>
                        </div>
                        <div><h4>پیشنهادات سرپرست:</h4><p className="p-2 border rounded-md bg-slate-50 min-h-[80px]">{review.supervisor_suggestions || '-'}</p></div>
                    </div>
                    
                    <table className="w-full mt-8 text-sm">
                        <tbody className="text-center">
                             <tr>
                                <td className="p-2 font-bold no-border">ارزیابی کننده (مسئول مستقیم):</td>
                                <td className="p-2 font-bold no-border">تایید کننده (سرپرست مستقیم):</td>
                                <td className="p-2 font-bold no-border">تایید کننده نهایی (مدیر عامل):</td>
                            </tr>
                            <tr>
                                <td className="p-2 no-border">{review.reviewer_name_and_signature || '-'}</td>
                                <td className="p-2 no-border">{review.supervisor_signature || '-'}</td>
                                <td className="p-2 no-border">{review.manager_signature || '-'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PerformanceReviewDetailsModal;
