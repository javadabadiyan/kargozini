import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Personnel, CommitmentLetter, DisciplinaryRecord } from '../../types';
import { holidays1403, PERSIAN_MONTHS } from '../holidays';
import { UsersIcon, BuildingOffice2Icon, MapPinIcon, HeartIcon, BriefcaseIcon, CalendarDaysIcon, CakeIcon, DocumentReportIcon, ShieldCheckIcon } from '../icons/Icons';
import DetailsModal from '../DetailsModal';

// Helper to convert numbers to Persian digits
const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
};

// Helper to convert Persian/Arabic numerals to English for calculations
const toEnglishDigits = (str: string): string => {
    if (!str) return '';
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
              .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};


// Age calculation helpers
const getCurrentPersianDate = (): { year: number; month: number; day: number } => {
    const today = new Date();
    // Use a specific locale that gives Persian digits to parse
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    const parts = formatter.formatToParts(today);

    const year = parseInt(toEnglishDigits(parts.find(p => p.type === 'year')?.value || '0'), 10);
    const month = parseInt(toEnglishDigits(parts.find(p => p.type === 'month')?.value || '0'), 10);
    const day = parseInt(toEnglishDigits(parts.find(p => p.type === 'day')?.value || '0'), 10);

    return { year, month, day };
};

const persianDateToAge = (birthDateStr: string | null | undefined, currentDate: { year: number }): number | null => {
    if (!birthDateStr || typeof birthDateStr !== 'string') return null;

    const englishBirthDateStr = toEnglishDigits(birthDateStr);

    // Match only the year part, e.g., "1370" from "1370/01/01"
    const match = englishBirthDateStr.match(/^(\d{4})/);
    if (!match) return null;
    
    const birthYear = parseInt(match[1], 10);
    if (isNaN(birthYear)) return null;

    const age = currentDate.year - birthYear;

    return age < 0 ? 0 : age;
};

const persianDateToServiceYears = (hireDateStr: string | null | undefined, currentDate: { year: number }): number | null => {
    if (!hireDateStr || typeof hireDateStr !== 'string') return null;
    const englishHireDateStr = toEnglishDigits(hireDateStr);
    const match = englishHireDateStr.match(/^(\d{4})/);
    if (!match) return null;
    const hireYear = parseInt(match[1], 10);
    if (isNaN(hireYear)) return null;
    const serviceYears = currentDate.year - hireYear;
    return serviceYears < 0 ? 0 : serviceYears;
};

// Reusable component for lists of stats
const StatListCard: React.FC<{ 
    title: string; 
    data: [string, string | number][]; 
    icon: React.ComponentType<{ className?: string }>;
    onItemClick?: (key: string) => void;
}> = ({ title, data, icon: Icon, onItemClick }) => {
    const maxValue = useMemo(() => {
        if (!data || data.length === 0) return 0;
        const numericValues = data.map(([, value]) => typeof value === 'string' ? parseFloat(value) : value).filter(v => !isNaN(v));
        return Math.max(...numericValues, 1); // Use 1 as minimum max to avoid division by zero
    }, [data]);
    
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-yellow-500', 
        'bg-pink-500', 'bg-purple-500', 'bg-teal-500', 'bg-sky-500'
    ];

    return (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md h-full flex flex-col transition-all duration-300">
            <div className="flex items-center mb-4">
                <Icon className="w-6 h-6 text-gray-500 dark:text-gray-400 ml-3" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
            </div>
            <div className="overflow-y-auto flex-1 pr-2 space-y-2 max-h-96">
                {data.map(([key, value], index) => {
                    const numericValue = typeof value === 'string' ? parseFloat(value) : Number(value);
                    const percentage = maxValue > 0 ? (numericValue / maxValue) * 100 : 0;
                    const barColor = colors[index % colors.length];

                    const content = (
                        <div className="relative w-full h-10 flex items-center pr-4 rounded-lg overflow-hidden group">
                            <div 
                                className={`absolute inset-0 ${barColor} opacity-20 dark:opacity-30 transform origin-right transition-transform duration-500 ease-out`}
                                style={{ width: `${percentage}%` }}
                            ></div>
                            <div className="relative flex justify-between items-center w-full z-10">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{key || 'نامشخص'}</span>
                                <span className="text-sm font-bold text-gray-800 dark:text-white bg-white/50 dark:bg-black/20 backdrop-blur-sm px-2 py-1 rounded-md">
                                    {toPersianDigits(value)}
                                </span>
                            </div>
                        </div>
                    );

                    if (onItemClick && Number(value) > 0) {
                        return (
                            <button 
                                key={key}
                                onClick={() => onItemClick(key)}
                                className="w-full text-right focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-blue-400 rounded-lg"
                                aria-label={`مشاهده جزئیات برای ${key}`}
                            >
                                {content}
                            </button>
                        );
                    }
                    
                    return <div key={key}>{content}</div>;
                })}
            </div>
        </div>
    );
};


const HolidayCalendarCard: React.FC<{ holidayInfo: { holidaysByMonth: number[], upcomingHolidays: any[] } }> = ({ holidayInfo }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md h-full flex flex-col transition-all duration-300">
        <div className="flex items-center mb-4">
            <CalendarDaysIcon className="w-6 h-6 text-gray-500 ml-3" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">تقویم تعطیلات رسمی سال ۱۴۰۳</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
            <div>
                <h4 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">تعداد روزهای تعطیل در هر ماه</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {PERSIAN_MONTHS.map((month, index) => (
                        <div key={month} className="flex justify-between items-center text-sm border-b border-dashed pb-2 dark:border-slate-700">
                            <span className="text-gray-600 dark:text-gray-300">{month}</span>
                            <span className="font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{toPersianDigits(holidayInfo.holidaysByMonth[index])}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="overflow-y-auto max-h-80 pr-2">
                <h4 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">تعطیلات رسمی پیش رو</h4>
                <ul className="space-y-3">
                    {holidayInfo.upcomingHolidays.map((holiday, index) => (
                        <li key={index} className="flex items-start p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <div className="text-center mr-4 flex-shrink-0">
                                <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{toPersianDigits(holiday.date[2])}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{PERSIAN_MONTHS[holiday.date[1] - 1]}</p>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-200">{holiday.description}</p>
                        </li>
                    ))}
                     {holidayInfo.upcomingHolidays.length === 0 && (
                        <p className="text-sm text-center text-gray-500 dark:text-gray-400 p-4">تعطیلی رسمی در ادامه سال یافت نشد.</p>
                    )}
                </ul>
            </div>
        </div>
    </div>
);

const DashboardPage: React.FC = () => {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [commitmentLetters, setCommitmentLetters] = useState<CommitmentLetter[]>([]);
    const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStatKey, setSelectedStatKey] = useState('total');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ title: string; data: any[]; mode: 'age' | 'service' | 'general' | 'commitment' | 'disciplinary' }>({ title: '', data: [], mode: 'general' });


    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setLoading(true);
                const [personnelRes, lettersRes, recordsRes] = await Promise.all([
                    fetch('/api/personnel?type=personnel&pageSize=100000'),
                    fetch('/api/personnel?type=commitment_letters'),
                    fetch('/api/personnel?type=disciplinary_records')
                ]);

                if (!personnelRes.ok || !lettersRes.ok || !recordsRes.ok) {
                    throw new Error('خطا در دریافت اطلاعات داشبورد');
                }

                const personnelData = await personnelRes.json();
                const lettersData = await lettersRes.json();
                const recordsData = await recordsRes.json();
                
                setPersonnel(personnelData.personnel || []);
                setCommitmentLetters(lettersData.letters || []);
                setDisciplinaryRecords(recordsData.records || []);

            } catch (err) {
                 setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, []);

    const stats = useMemo(() => {
        if (loading) return null;

        const groupAndCount = (key: keyof Personnel) => {
            return personnel.reduce((acc, p) => {
                const value = p[key] || 'نامشخص';
                acc[value] = (acc[value] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
        };

        const groupPersonnelByKey = (key: keyof Personnel) => {
            return personnel.reduce((acc, p) => {
                const value = p[key] || 'نامشخص';
                if (!acc[value]) acc[value] = [];
                acc[value].push(p);
                return acc;
            }, {} as Record<string, Personnel[]>);
        };
        
        const toSortedArray = (obj: Record<string, number>) => Object.entries(obj).sort(([, a], [, b]) => b - a);
        
        const jobGroupCounts = groupAndCount('job_group');
        const sortedJobGroups = Object.entries(jobGroupCounts).sort(([keyA], [keyB]) => {
            const extractNumber = (str: string | null) => {
                if (!str || str === 'نامشخص') return Infinity;
                const match = toEnglishDigits(str).match(/\d+/);
                return match ? parseInt(match[0], 10) : Infinity;
            };
            const numA = extractNumber(keyA);
            const numB = extractNumber(keyB);
            if (numA === Infinity && numB === Infinity) return keyA.localeCompare(keyB, 'fa');
            return numA - numB;
        });
        
        const currentDate = getCurrentPersianDate();
        const ages: number[] = [];
        const closeToRetirementList: (Personnel & { age: number })[] = [];
        const retiredList: (Personnel & { age: number })[] = [];
        const ageGroups: Record<string, number> = { 'زیر ۳۰ سال': 0, '۳۱-۴۰ سال': 0, '۴۱-۵۰ سال': 0, '۵۱-۶۰ سال': 0, 'بیشتر از ۶۰': 0, 'نامشخص': 0 };
        const byAgeGroupPersonnel: Record<string, (Personnel & { age: number })[]> = { 'زیر ۳۰ سال': [], '۳۱-۴۰ سال': [], '۴۱-۵۰ سال': [], '۵۱-۶۰ سال': [], 'بیشتر از ۶۰': [], 'نامشخص': [] };
        const serviceYearsList: number[] = [];
        const serviceYearGroups: Record<string, number> = { 'کمتر از ۵ سال': 0, '۵ تا ۱۰ سال': 0, '۱۱ تا ۱۵ سال': 0, '۱۶ تا ۲۰ سال': 0, 'بیشتر از ۲۰ سال': 0, 'نامشخص': 0 };
        const byServiceYearsPersonnel: Record<string, (Personnel & { serviceYears: number })[]> = { 'کمتر از ۵ سال': [], '۵ تا ۱۰ سال': [], '۱۱ تا ۱۵ سال': [], '۱۶ تا ۲۰ سال': [], 'بیشتر از ۲۰ سال': [], 'نامشخص': [] };

        personnel.forEach(p => {
            const age = persianDateToAge(p.birth_date, currentDate);
            const personnelWithAge = { ...p, age: age ?? -1 };
            if (age !== null) {
                ages.push(age);
                if (age >= 55 && age < 60) closeToRetirementList.push(personnelWithAge);
                if (age >= 60) retiredList.push(personnelWithAge);
                if (age <= 30) { ageGroups['زیر ۳۰ سال']++; byAgeGroupPersonnel['زیر ۳۰ سال'].push(personnelWithAge); }
                else if (age <= 40) { ageGroups['۳۱-۴۰ سال']++; byAgeGroupPersonnel['۳۱-۴۰ سال'].push(personnelWithAge); }
                else if (age <= 50) { ageGroups['۴۱-۵۰ سال']++; byAgeGroupPersonnel['۴۱-۵۰ سال'].push(personnelWithAge); }
                else if (age <= 60) { ageGroups['۵۱-۶۰ سال']++; byAgeGroupPersonnel['۵۱-۶۰ سال'].push(personnelWithAge); }
                else if (age > 60) { ageGroups['بیشتر از ۶۰']++; byAgeGroupPersonnel['بیشتر از ۶۰'].push(personnelWithAge); }
            } else { ageGroups['نامشخص']++; byAgeGroupPersonnel['نامشخص'].push(personnelWithAge); }
            
            const serviceYears = persianDateToServiceYears(p.hire_date, currentDate);
            const personnelWithService = { ...p, serviceYears: serviceYears ?? -1 };
            if (serviceYears !== null) {
                serviceYearsList.push(serviceYears);
                if (serviceYears < 5) { serviceYearGroups['کمتر از ۵ سال']++; byServiceYearsPersonnel['کمتر از ۵ سال'].push(personnelWithService); }
                else if (serviceYears <= 10) { serviceYearGroups['۵ تا ۱۰ سال']++; byServiceYearsPersonnel['۵ تا ۱۰ سال'].push(personnelWithService); }
                else if (serviceYears <= 15) { serviceYearGroups['۱۱ تا ۱۵ سال']++; byServiceYearsPersonnel['۱۱ تا ۱۵ سال'].push(personnelWithService); }
                else if (serviceYears <= 20) { serviceYearGroups['۱۶ تا ۲۰ سال']++; byServiceYearsPersonnel['۱۶ تا ۲۰ سال'].push(personnelWithService); }
                else { serviceYearGroups['بیشتر از ۲۰ سال']++; byServiceYearsPersonnel['بیشتر از ۲۰ سال'].push(personnelWithService); }
            } else { serviceYearGroups['نامشخص']++; byServiceYearsPersonnel['نامشخص'].push(personnelWithService); }
        });

        const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
        const averageService = serviceYearsList.length > 0 ? Math.round(serviceYearsList.reduce((a, b) => a + b, 0) / serviceYearsList.length) : 0;
        
        const byCommitmentBank = commitmentLetters.reduce((acc, letter) => {
            const bank = letter.bank_name || 'نامشخص';
            acc[bank] = (acc[bank] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const byCommitmentBankData = commitmentLetters.reduce((acc, letter) => {
            const bank = letter.bank_name || 'نامشخص';
            if (!acc[bank]) acc[bank] = [];
            acc[bank].push(letter);
            return acc;
        }, {} as Record<string, CommitmentLetter[]>);

        const byCommitmentGuarantor = commitmentLetters.reduce((acc, letter) => {
            const guarantor = letter.guarantor_name || 'نامشخص';
            acc[guarantor] = (acc[guarantor] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const byCommitmentGuarantorData = commitmentLetters.reduce((acc, letter) => {
            const guarantor = letter.guarantor_name || 'نامشخص';
            if (!acc[guarantor]) acc[guarantor] = [];
            acc[guarantor].push(letter);
            return acc;
        }, {} as Record<string, CommitmentLetter[]>);

        const disciplinaryKeywords = ['توبیخ کتبی', 'تشویق', 'اخطار کتبی', 'اخطار شفاهی', 'تذکر شفاهی', 'فسخ قرارداد', 'تعهد کتبی'];
        const byDisciplinaryAction = disciplinaryKeywords.reduce((acc, key) => ({ ...acc, [key]: 0 }), {} as Record<string, number>);
        const byDisciplinaryActionData = disciplinaryKeywords.reduce((acc, key) => ({ ...acc, [key]: [] }), {} as Record<string, DisciplinaryRecord[]>);
        
        disciplinaryRecords.forEach(record => {
            disciplinaryKeywords.forEach(key => {
                if (record.final_decision?.includes(key)) {
                    byDisciplinaryAction[key]++;
                    byDisciplinaryActionData[key].push(record);
                }
            });
        });

        return {
            total: personnel.length, averageAge, averageService, closeToRetirementList, retiredList,
            byDepartment: toSortedArray(groupAndCount('department')), byDepartmentPersonnel: groupPersonnelByKey('department'),
            byServiceLocation: toSortedArray(groupAndCount('service_location')), byServiceLocationPersonnel: groupPersonnelByKey('service_location'),
            byPosition: toSortedArray(groupAndCount('position')), byPositionPersonnel: groupPersonnelByKey('position'),
            byMaritalStatus: toSortedArray(groupAndCount('marital_status')), byMaritalStatusPersonnel: groupPersonnelByKey('marital_status'),
            byJobGroup: sortedJobGroups, byJobGroupPersonnel: groupPersonnelByKey('job_group'),
            byDecreeFactors: toSortedArray(groupAndCount('sum_of_decree_factors')), byDecreeFactorsPersonnel: groupPersonnelByKey('sum_of_decree_factors'),
            byAgeGroup: toSortedArray(ageGroups), byAgeGroupPersonnel,
            byServiceYears: toSortedArray(serviceYearGroups), byServiceYearsPersonnel,
            byCommitmentBank: toSortedArray(byCommitmentBank),
            byCommitmentBankData,
            byCommitmentGuarantor: toSortedArray(byCommitmentGuarantor),
            byCommitmentGuarantorData,
            byDisciplinaryAction: Object.entries(byDisciplinaryAction).sort(([, a], [, b]) => b - a),
            byDisciplinaryActionData,
        };
    }, [personnel, loading, commitmentLetters, disciplinaryRecords]);

    const topStats = useMemo(() => {
        if (!stats) return [];
        return [
            { key: 'total', label: 'کل پرسنل', value: toPersianDigits(stats.total), icon: UsersIcon, color: 'bg-blue-500', modalData: null },
            { key: 'avgAge', label: 'میانگین سن', value: `${toPersianDigits(stats.averageAge)} سال`, icon: CakeIcon, color: 'bg-green-500', modalData: null },
            { key: 'avgService', label: 'میانگین سابقه', value: `${toPersianDigits(stats.averageService)} سال`, icon: BriefcaseIcon, color: 'bg-indigo-500', modalData: null },
            { key: 'nearRetirement', label: 'نزدیک به بازنشستگی (۵۵-۵۹)', value: toPersianDigits(stats.closeToRetirementList.length), icon: CalendarDaysIcon, color: 'bg-orange-500', modalData: { title: 'لیست پرسنل نزدیک به بازنشستگی', data: stats.closeToRetirementList, mode: 'age' as const } },
            { key: 'atRetirement', label: 'در سن بازنشستگی (۶۰+)', value: toPersianDigits(stats.retiredList.length), icon: CalendarDaysIcon, color: 'bg-red-500', modalData: { title: 'لیست پرسنل در سن بازنشستگی', data: stats.retiredList, mode: 'age' as const } }
        ];
    }, [stats]);

    const holidayInfo = useMemo(() => {
        const holidaysByMonth: number[] = Array(12).fill(0);
        holidays1403.forEach(holiday => {
            const monthIndex = holiday.date[1] - 1;
            if (monthIndex >= 0 && monthIndex < 12) { holidaysByMonth[monthIndex]++; }
        });

        const today = new Date();
        const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' });
        const parts = formatter.formatToParts(today);
        const currentYear = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
        const currentMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
        const currentDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);

        const upcomingHolidays = holidays1403.filter(h => {
            const [hYear, hMonth, hDay] = h.date;
            if (hYear < currentYear) return false;
            if (hYear > currentYear) return true;
            if (hMonth < currentMonth) return false;
            if (hMonth > currentMonth) return true;
            return hDay >= currentDay;
        }).slice(0, 5);
        
        return { holidaysByMonth, upcomingHolidays };
    }, []);
    
    const handleStatClick = (title: string, dataList: any[], mode: 'age' | 'service' | 'general' | 'commitment' | 'disciplinary') => {
        setModalData({ title, data: dataList, mode });
        setIsModalOpen(true);
    };

    const allStatOptions = [
        ...topStats.map(s => ({ key: s.key, label: s.label })),
        { key: 'byDepartment', label: 'آمار بر اساس واحد' },
        { key: 'byServiceLocation', label: 'آمار بر اساس محل خدمت' },
        { key: 'byAgeGroup', label: 'آمار بر اساس گروه سنی' },
        { key: 'byServiceYears', label: 'آمار بر اساس سابقه خدمت' },
        { key: 'byPosition', label: 'آمار بر اساس سمت' },
        { key: 'byJobGroup', label: 'آمار بر اساس گروه شغلی' },
        { key: 'byMaritalStatus', label: 'آمار بر اساس وضعیت تاهل' },
        { key: 'byCommitmentBank', label: 'آمار تعهدات بر اساس بانک' },
        { key: 'byCommitmentGuarantor', label: 'آمار تعهدات بر اساس ضامن' },
        { key: 'byDisciplinaryAction', label: 'آمار کمیته انضباطی' },
        { key: 'holidays', label: 'تقویم تعطیلات' },
    ];

    const renderSelectedStat = () => {
        if (!stats) return <div className="text-center p-10 text-gray-500">داده‌ای برای نمایش وجود ندارد.</div>;

        const topStatInfo = topStats.find(s => s.key === selectedStatKey);
        if (topStatInfo) {
            return (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 p-6 rounded-xl shadow-lg flex items-center justify-center flex-col h-full min-h-[400px] transition-all duration-300">
                    <div className={`p-4 rounded-full ${topStatInfo.color} shadow-lg`}>
                        <topStatInfo.icon className="w-10 h-10 text-white" />
                    </div>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">{topStatInfo.label}</p>
                    {topStatInfo.modalData ? (
                        <button onClick={() => handleStatClick(topStatInfo.modalData!.title, topStatInfo.modalData!.data, topStatInfo.modalData!.mode)} className="text-6xl font-bold text-gray-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none">
                            {topStatInfo.value}
                        </button>
                    ) : (
                        <p className="text-6xl font-bold text-gray-800 dark:text-white">{topStatInfo.value}</p>
                    )}
                </div>
            );
        }

        switch (selectedStatKey) {
            case 'byDepartment': return <StatListCard title="آمار بر اساس واحد" data={stats.byDepartment} icon={BuildingOffice2Icon} onItemClick={(key) => handleStatClick(`لیست پرسنل واحد: ${key}`, stats.byDepartmentPersonnel[key], 'general')} />;
            case 'byServiceLocation': return <StatListCard title="آمار بر اساس محل خدمت" data={stats.byServiceLocation} icon={MapPinIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل محل خدمت: ${key}`, stats.byServiceLocationPersonnel[key], 'general')} />;
            case 'byAgeGroup': return <StatListCard title="آمار بر اساس گروه سنی" data={stats.byAgeGroup} icon={CakeIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل: ${key}`, stats.byAgeGroupPersonnel[key], 'age')} />;
            case 'byServiceYears': return <StatListCard title="آمار بر اساس سابقه خدمت" data={stats.byServiceYears} icon={BriefcaseIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل: ${key}`, stats.byServiceYearsPersonnel[key], 'service')} />;
            case 'byPosition': return <StatListCard title="آمار بر اساس سمت" data={stats.byPosition} icon={BriefcaseIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با سمت: ${key}`, stats.byPositionPersonnel[key], 'general')} />;
            case 'byJobGroup': return <StatListCard title="آمار بر اساس گروه شغلی" data={stats.byJobGroup} icon={DocumentReportIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با گروه شغلی: ${key}`, stats.byJobGroupPersonnel[key], 'general')} />;
            case 'byMaritalStatus': return <StatListCard title="آمار بر اساس وضعیت تاهل" data={stats.byMaritalStatus} icon={HeartIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با وضعیت تاهل: ${key}`, stats.byMaritalStatusPersonnel[key], 'general')} />;
            case 'byCommitmentBank': return <StatListCard title="آمار تعهدات بر اساس بانک" data={stats.byCommitmentBank} icon={DocumentReportIcon} onItemClick={(key) => handleStatClick(`لیست تعهدات بانک: ${key}`, stats.byCommitmentBankData[key], 'commitment')} />;
            case 'byCommitmentGuarantor': return <StatListCard title="آمار تعهدات بر اساس ضامن" data={stats.byCommitmentGuarantor} icon={UsersIcon} onItemClick={(key) => handleStatClick(`لیست تعهدات ضامن: ${key}`, stats.byCommitmentGuarantorData[key], 'commitment')} />;
            case 'byDisciplinaryAction': return <StatListCard title="آمار کمیته انضباطی" data={stats.byDisciplinaryAction} icon={ShieldCheckIcon} onItemClick={(key) => handleStatClick(`لیست افراد با رای: ${key}`, stats.byDisciplinaryActionData[key], 'disciplinary')} />;
            case 'holidays': return <HolidayCalendarCard holidayInfo={holidayInfo} />;
            default: return null;
        }
    };

    if (loading) return <div className="text-center p-10">در حال بارگذاری اطلاعات داشبورد...</div>;
    if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
    
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <div className="space-y-4">
                    <label htmlFor="stat-selector" className="block text-lg font-bold text-gray-700 dark:text-gray-300">
                        نمایش آمار:
                    </label>
                    <select 
                        id="stat-selector"
                        value={selectedStatKey}
                        onChange={(e) => setSelectedStatKey(e.target.value)}
                        className="w-full md:w-1/2 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                        {allStatOptions.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="min-h-[400px]">
                {renderSelectedStat()}
            </div>

            <DetailsModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalData.title}
                data={modalData.data}
                mode={modalData.mode}
            />
        </div>
    );
};

export default DashboardPage;