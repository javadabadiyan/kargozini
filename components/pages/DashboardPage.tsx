import React, { useState, useEffect, useMemo } from 'react';
import type { Personnel } from '../../types';
import { holidays1403, PERSIAN_MONTHS } from '../holidays';
import { UsersIcon, BuildingOffice2Icon, MapPinIcon, HeartIcon, BriefcaseIcon, CalendarDaysIcon, CakeIcon, DocumentReportIcon } from '../icons/Icons';
import RetirementInfoModal from '../RetirementInfoModal';

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


// Reusable Stat Card component - smaller version
const StatCard: React.FC<{ title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md flex items-center space-x-3 space-x-reverse">
        <div className={`p-2.5 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        </div>
    </div>
);

// Reusable component for lists of stats
const StatListCard: React.FC<{ 
    title: string; 
    data: [string, string | number][]; 
    icon: React.ComponentType<{ className?: string }>;
    onItemClick?: (key: string) => void;
}> = ({ title, data, icon: Icon, onItemClick }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md h-full flex flex-col">
        <div className="flex items-center mb-4">
            <Icon className="w-6 h-6 text-gray-500 ml-3" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
        </div>
        <div className="overflow-y-auto flex-1 pr-2 max-h-96">
            <ul className="space-y-3">
                {data.map(([key, value]) => (
                    <li key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{key || 'نامشخص'}</span>
                        {onItemClick ? (
                             <button 
                                onClick={() => onItemClick(key)}
                                className="font-semibold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                {toPersianDigits(value)}
                            </button>
                        ) : (
                            <span className="font-semibold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{toPersianDigits(value)}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const HolidayCalendarCard: React.FC<{ holidayInfo: { holidaysByMonth: number[], upcomingHolidays: any[] } }> = ({ holidayInfo }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md">
        <div className="flex items-center mb-4">
            <CalendarDaysIcon className="w-6 h-6 text-gray-500 ml-3" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">تقویم تعطیلات رسمی سال ۱۴۰۳</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
            <div>
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedStat, setSelectedStat] = useState('byDepartment');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ title: string; personnel: any[]; mode: 'age' | 'service' | 'general' }>({ title: '', personnel: [], mode: 'general' });


    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/personnel?type=personnel&pageSize=100000');
                if (!response.ok) {
                    throw new Error('خطا در دریافت اطلاعات پرسنل');
                }
                const data = await response.json();
                setPersonnel(data.personnel || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'یک خطای ناشناخته رخ داد');
            } finally {
                setLoading(false);
            }
        };
        fetchPersonnel();
    }, []);

    const stats = useMemo(() => {
        if (!personnel.length) return null;

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
            } else {
                ageGroups['نامشخص']++;
                byAgeGroupPersonnel['نامشخص'].push(personnelWithAge);
            }
            
            const serviceYears = persianDateToServiceYears(p.hire_date, currentDate);
            const personnelWithService = { ...p, serviceYears: serviceYears ?? -1 };
            if (serviceYears !== null) {
                serviceYearsList.push(serviceYears);
                if (serviceYears < 5) { serviceYearGroups['کمتر از ۵ سال']++; byServiceYearsPersonnel['کمتر از ۵ سال'].push(personnelWithService); }
                else if (serviceYears <= 10) { serviceYearGroups['۵ تا ۱۰ سال']++; byServiceYearsPersonnel['۵ تا ۱۰ سال'].push(personnelWithService); }
                else if (serviceYears <= 15) { serviceYearGroups['۱۱ تا ۱۵ سال']++; byServiceYearsPersonnel['۱۱ تا ۱۵ سال'].push(personnelWithService); }
                else if (serviceYears <= 20) { serviceYearGroups['۱۶ تا ۲۰ سال']++; byServiceYearsPersonnel['۱۶ تا ۲۰ سال'].push(personnelWithService); }
                else { serviceYearGroups['بیشتر از ۲۰ سال']++; byServiceYearsPersonnel['بیشتر از ۲۰ سال'].push(personnelWithService); }
            } else {
                 serviceYearGroups['نامشخص']++; 
                 byServiceYearsPersonnel['نامشخص'].push(personnelWithService);
            }
        });

        const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
        const averageService = serviceYearsList.length > 0 ? Math.round(serviceYearsList.reduce((a, b) => a + b, 0) / serviceYearsList.length) : 0;

        return {
            total: personnel.length,
            byDepartment: toSortedArray(groupAndCount('department')),
            byDepartmentPersonnel: groupPersonnelByKey('department'),
            byServiceLocation: toSortedArray(groupAndCount('service_location')),
            byServiceLocationPersonnel: groupPersonnelByKey('service_location'),
            byPosition: toSortedArray(groupAndCount('position')),
            byPositionPersonnel: groupPersonnelByKey('position'),
            byMaritalStatus: toSortedArray(groupAndCount('marital_status')),
            byMaritalStatusPersonnel: groupPersonnelByKey('marital_status'),
            byJobGroup: toSortedArray(groupAndCount('job_group')),
            byJobGroupPersonnel: groupPersonnelByKey('job_group'),
            byDecreeFactors: toSortedArray(groupAndCount('sum_of_decree_factors')),
            byDecreeFactorsPersonnel: groupPersonnelByKey('sum_of_decree_factors'),
            averageAge,
            closeToRetirementList,
            retiredList,
            byAgeGroup: toSortedArray(ageGroups),
            byAgeGroupPersonnel,
            averageService,
            byServiceYears: toSortedArray(serviceYearGroups),
            byServiceYearsPersonnel
        };
    }, [personnel]);

    const holidayInfo = useMemo(() => {
        const holidaysByMonth: number[] = Array(12).fill(0);
        holidays1403.forEach(holiday => {
            const monthIndex = holiday.date[1] - 1;
            if (monthIndex >= 0 && monthIndex < 12) {
                holidaysByMonth[monthIndex]++;
            }
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
    
    const handleStatClick = (title: string, personnelList: any[], mode: 'age' | 'service' | 'general') => {
        setModalData({ title, personnel: personnelList, mode });
        setIsModalOpen(true);
    };

    const statOptions = [
        { key: 'byDepartment', label: 'آمار بر اساس واحد' },
        { key: 'byServiceLocation', label: 'آمار بر اساس محل خدمت' },
        { key: 'byAgeGroup', label: 'آمار بر اساس گروه سنی' },
        { key: 'byServiceYears', label: 'آمار بر اساس سابقه خدمت' },
        { key: 'byPosition', label: 'آمار بر اساس سمت' },
        { key: 'byJobGroup', label: 'آمار بر اساس گروه شغلی' },
        { key: 'byDecreeFactors', label: 'آمار بر اساس جمع عوامل حکمی' },
        { key: 'byMaritalStatus', label: 'آمار بر اساس وضعیت تاهل' },
        { key: 'holidays', label: 'تقویم تعطیلات' },
    ];

    const renderSelectedStat = () => {
        if (!stats) return <div className="text-center p-10 text-gray-500">داده‌ای برای نمایش وجود ندارد.</div>;
        switch (selectedStat) {
            case 'byDepartment':
                return <StatListCard title="آمار بر اساس واحد" data={stats.byDepartment} icon={BuildingOffice2Icon} onItemClick={(key) => handleStatClick(`لیست پرسنل واحد: ${key}`, stats.byDepartmentPersonnel[key], 'general')} />;
            case 'byServiceLocation':
                return <StatListCard title="آمار بر اساس محل خدمت" data={stats.byServiceLocation} icon={MapPinIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل محل خدمت: ${key}`, stats.byServiceLocationPersonnel[key], 'general')} />;
            case 'byAgeGroup':
                return <StatListCard 
                            title="آمار بر اساس گروه سنی" 
                            data={stats.byAgeGroup} 
                            icon={CakeIcon} 
                            onItemClick={(key) => handleStatClick(`لیست پرسنل: ${key}`, stats.byAgeGroupPersonnel[key], 'age')}
                        />;
             case 'byServiceYears':
                return <StatListCard 
                            title="آمار بر اساس سابقه خدمت" 
                            data={stats.byServiceYears} 
                            icon={BriefcaseIcon} 
                            onItemClick={(key) => handleStatClick(`لیست پرسنل: ${key}`, stats.byServiceYearsPersonnel[key], 'service')}
                        />;
            case 'byPosition':
                return <StatListCard title="آمار بر اساس سمت" data={stats.byPosition} icon={BriefcaseIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با سمت: ${key}`, stats.byPositionPersonnel[key], 'general')} />;
            case 'byJobGroup':
                return <StatListCard title="آمار بر اساس گروه شغلی" data={stats.byJobGroup} icon={DocumentReportIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با گروه شغلی: ${key}`, stats.byJobGroupPersonnel[key], 'general')} />;
            case 'byDecreeFactors':
                return <StatListCard title="آمار بر اساس جمع عوامل حکمی" data={stats.byDecreeFactors} icon={DocumentReportIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با جمع عوامل حکمی: ${key}`, stats.byDecreeFactorsPersonnel[key], 'general')} />;
            case 'byMaritalStatus':
                return <StatListCard title="آمار بر اساس وضعیت تاهل" data={stats.byMaritalStatus} icon={HeartIcon} onItemClick={(key) => handleStatClick(`لیست پرسنل با وضعیت تاهل: ${key}`, stats.byMaritalStatusPersonnel[key], 'general')} />;
            case 'holidays':
                return <HolidayCalendarCard holidayInfo={holidayInfo} />;
            default:
                return null;
        }
    };

    if (loading) {
        return <div className="text-center p-10">در حال بارگذاری اطلاعات داشبورد...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">{error}</div>;
    }
    
    return (
        <div className="space-y-6">
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="کل پرسنل" value={toPersianDigits(stats.total)} icon={UsersIcon} color="bg-blue-500" />
                    <StatCard title="میانگین سن" value={`${toPersianDigits(stats.averageAge)} سال`} icon={CakeIcon} color="bg-green-500" />
                    <StatCard title="میانگین سابقه" value={`${toPersianDigits(stats.averageService)} سال`} icon={BriefcaseIcon} color="bg-indigo-500" />
                    
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md flex items-center space-x-3 space-x-reverse">
                        <div className="p-2.5 rounded-full bg-orange-500">
                            <CalendarDaysIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <button onClick={() => handleStatClick('لیست پرسنل نزدیک به بازنشستگی', stats.closeToRetirementList, 'age')} className="text-2xl font-bold text-gray-800 dark:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                                {toPersianDigits(stats.closeToRetirementList.length)}
                            </button>
                            <p className="text-sm text-gray-500 dark:text-gray-400">نزدیک به بازنشستگی (۵۵-۵۹)</p>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md flex items-center space-x-3 space-x-reverse">
                        <div className="p-2.5 rounded-full bg-red-500">
                            <CalendarDaysIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <button onClick={() => handleStatClick('لیست پرسنل در سن بازنشستگی', stats.retiredList, 'age')} className="text-2xl font-bold text-gray-800 dark:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
                                {toPersianDigits(stats.retiredList.length)}
                            </button>
                            <p className="text-sm text-gray-500 dark:text-gray-400">در سن بازنشستگی (۶۰+)</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
                <label htmlFor="stat-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    نمایش آمار تفصیلی بر اساس:
                </label>
                <select 
                    id="stat-selector"
                    value={selectedStat}
                    onChange={(e) => setSelectedStat(e.target.value)}
                    className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                >
                    {statOptions.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div className="min-h-[400px]">
                {renderSelectedStat()}
            </div>

            <RetirementInfoModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalData.title}
                personnel={modalData.personnel}
                mode={modalData.mode}
            />
        </div>
    );
};

export default DashboardPage;
