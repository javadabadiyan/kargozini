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
    const match = englishBirthDateStr.match(/^(\d{4})/);
    if (!match) return null;
    const birthYear = parseInt(match[1], 10);
    if (isNaN(birthYear)) return null;
    const age = currentDate.year - birthYear;
    return age < 0 ? 0 : age;
};

// Shared style for all dashboard cards for a consistent "glass" look
const cardStyle = "bg-white/30 dark:bg-slate-800/40 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-lg transition-all duration-300";

// --- NEW & REDESIGNED COMPONENTS ---

// 1. Top-level Stat Cards
const StatCard: React.FC<{
    title: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    onClick?: () => void;
}> = ({ title, value, icon: Icon, color, onClick }) => (
    <div
        onClick={onClick}
        className={`${cardStyle} flex flex-col justify-between h-full ${onClick ? 'cursor-pointer hover:border-white/40 hover:shadow-xl' : ''}`}
    >
        <div className={`p-3 rounded-full self-start ${color}`}>
            <Icon className="w-7 h-7 text-white" />
        </div>
        <div>
            <p className="text-4xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
        </div>
    </div>
);

// 2. Bar Chart Card for visualizing data distributions
const ChartCard: React.FC<{
    title: string;
    data: { label: string; value: number }[];
    icon: React.ComponentType<{ className?: string }>;
    onItemClick?: (key: string) => void;
}> = ({ title, data, icon: Icon, onItemClick }) => {
    const maxValue = useMemo(() => Math.max(...data.map(item => item.value), 0), [data]);

    return (
        <div className={`${cardStyle} col-span-1 md:col-span-1 lg:col-span-2`}>
            <div className="flex items-center mb-5">
                <Icon className="w-6 h-6 text-gray-600 dark:text-gray-300 ml-3" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
            </div>
            <div className="space-y-4">
                {data.map(({ label, value }) => (
                    <div key={label} className="grid grid-cols-12 items-center gap-2 text-sm group">
                        <div className="col-span-4 truncate text-gray-600 dark:text-gray-300">{label || 'نامشخص'}</div>
                        <div className="col-span-6 bg-slate-200/70 dark:bg-slate-700/50 rounded-full h-4">
                            <div
                                className="bg-blue-500 h-4 rounded-full transition-all duration-500 ease-out group-hover:bg-blue-400"
                                style={{ width: `${(value / maxValue) * 100}%` }}
                            />
                        </div>
                        <div className="col-span-2 text-right font-semibold text-gray-700 dark:text-gray-200">
                             {onItemClick ? (
                                <button
                                    onClick={() => onItemClick(label)}
                                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-400 rounded-sm px-1"
                                >
                                    {toPersianDigits(value)}
                                </button>
                            ) : (
                                toPersianDigits(value)
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// 3. Restyled Holiday Calendar Card
const HolidayCalendarCard: React.FC<{ holidayInfo: { holidaysByMonth: number[], upcomingHolidays: any[] } }> = ({ holidayInfo }) => (
    <div className={`${cardStyle} col-span-1 md:col-span-2 lg:col-span-4`}>
        <div className="flex items-center mb-4">
            <CalendarDaysIcon className="w-6 h-6 text-gray-600 dark:text-gray-300 ml-3" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">تقویم تعطیلات رسمی سال ۱۴۰۳</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h4 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">تعداد روزهای تعطیل در هر ماه</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {PERSIAN_MONTHS.map((month, index) => (
                        <div key={month} className="flex justify-between items-center text-sm border-b border-dashed border-slate-300/50 pb-2 dark:border-slate-700/50">
                            <span className="text-gray-600 dark:text-gray-300">{month}</span>
                            <span className="font-bold bg-slate-100/50 dark:bg-slate-700/50 px-2 py-0.5 rounded-full">{toPersianDigits(holidayInfo.holidaysByMonth[index])}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="font-semibold mb-3 text-gray-700 dark:text-gray-200">تعطیلات رسمی پیش رو</h4>
                <ul className="space-y-3">
                    {holidayInfo.upcomingHolidays.map((holiday, index) => (
                        <li key={index} className="flex items-start p-3 bg-slate-100/50 dark:bg-slate-700/50 rounded-lg">
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

        const currentDate = getCurrentPersianDate();
        
        const closeToRetirementList: (Personnel & { age: number })[] = [];
        const retiredList: (Personnel & { age: number })[] = [];
        const ages: number[] = [];
        const serviceYearsList: number[] = [];

        personnel.forEach(p => {
            const age = persianDateToAge(p.birth_date, currentDate);
            if (age !== null) {
                ages.push(age);
                if (age >= 55 && age < 60) closeToRetirementList.push({ ...p, age });
                if (age >= 60) retiredList.push({ ...p, age });
            }
            const serviceYears = persianDateToAge(p.hire_date, currentDate);
             if (serviceYears !== null) {
                serviceYearsList.push(serviceYears);
            }
        });
        
        const groupAndCount = (key: keyof Personnel) => {
            const counts = personnel.reduce((acc, p) => {
                const value = p[key] || 'نامشخص';
                acc[value] = (acc[value] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            return Object.entries(counts)
                         .sort(([, a], [, b]) => b - a)
                         .map(([label, value]) => ({ label, value }));
        };
        
        const groupPersonnelByKey = (key: keyof Personnel) => {
            return personnel.reduce((acc, p) => {
                const value = p[key] || 'نامشخص';
                if (!acc[value]) acc[value] = [];
                acc[value].push(p);
                return acc;
            }, {} as Record<string, Personnel[]>);
        };
        
        const ageGroups = personnel.reduce((acc, p) => {
            const age = persianDateToAge(p.birth_date, currentDate);
            if (age === null) { acc['نامشخص']++; return acc; }
            if (age <= 30) acc['زیر ۳۰ سال']++;
            else if (age <= 40) acc['۳۱-۴۰ سال']++;
            else if (age <= 50) acc['۴۱-۵۰ سال']++;
            else if (age <= 60) acc['۵۱-۶۰ سال']++;
            else acc['بیشتر از ۶۰']++;
            return acc;
        }, { 'زیر ۳۰ سال': 0, '۳۱-۴۰ سال': 0, '۴۱-۵۰ سال': 0, '۵۱-۶۰ سال': 0, 'بیشتر از ۶۰': 0, 'نامشخص': 0 });


        return {
            total: personnel.length,
            averageAge: ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0,
            averageService: serviceYearsList.length > 0 ? Math.round(serviceYearsList.reduce((a, b) => a + b, 0) / serviceYearsList.length) : 0,
            closeToRetirementList,
            retiredList,
            byDepartment: groupAndCount('department'),
            byDepartmentPersonnel: groupPersonnelByKey('department'),
            byAgeGroup: Object.entries(ageGroups).map(([label, value]) => ({ label, value })),
        };
    }, [personnel]);

    const topStats = useMemo(() => {
        if (!stats) return [];
        return [
            { key: 'total', label: 'کل پرسنل', value: toPersianDigits(stats.total), icon: UsersIcon, color: 'bg-blue-500' },
            { key: 'avgAge', label: 'میانگین سن', value: `${toPersianDigits(stats.averageAge)} سال`, icon: CakeIcon, color: 'bg-green-500' },
            { key: 'avgService', label: 'میانگین سابقه', value: `${toPersianDigits(stats.averageService)} سال`, icon: BriefcaseIcon, color: 'bg-indigo-500' },
            { 
                key: 'nearRetirement', 
                label: 'نزدیک به بازنشستگی (۵۵-۵۹)', 
                value: toPersianDigits(stats.closeToRetirementList.length), 
                icon: CalendarDaysIcon, 
                color: 'bg-orange-500', 
                onClick: () => handleStatClick('لیست پرسنل نزدیک به بازنشستگی', stats.closeToRetirementList, 'age')
            },
            { 
                key: 'atRetirement', 
                label: 'در سن بازنشستگی (۶۰+)', 
                value: toPersianDigits(stats.retiredList.length), 
                icon: CalendarDaysIcon, 
                color: 'bg-red-500', 
                onClick: () => handleStatClick('لیست پرسنل در سن بازنشستگی', stats.retiredList, 'age')
            }
        ];
    }, [stats]);

    const holidayInfo = useMemo(() => {
        const holidaysByMonth: number[] = Array(12).fill(0);
        holidays1403.forEach(holiday => { holidaysByMonth[holiday.date[1] - 1]++; });

        const { year, month, day } = getCurrentPersianDate();
        
        const upcomingHolidays = holidays1403.filter(h => {
            const [hYear, hMonth, hDay] = h.date;
            if (hYear < year) return false;
            if (hYear > year) return true;
            if (hMonth < month) return false;
            if (hMonth > month) return true;
            return hDay >= day;
        }).slice(0, 5);
        
        return { holidaysByMonth, upcomingHolidays };
    }, []);
    
    const handleStatClick = (title: string, personnelList: any[], mode: 'age' | 'service' | 'general') => {
        setModalData({ title, personnel: personnelList, mode });
        setIsModalOpen(true);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full text-lg text-gray-500 dark:text-gray-300">در حال بارگذاری اطلاعات داشبورد...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center h-full text-lg text-red-500">{error}</div>;
    }
    
    if (!stats) {
        return <div className="flex items-center justify-center h-full text-lg text-gray-500 dark:text-gray-300">هیچ داده‌ای برای نمایش در داشبورد وجود ندارد.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {topStats.map(stat => (
                    <StatCard key={stat.key} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color} onClick={stat.onClick}/>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <ChartCard
                    title="آمار بر اساس واحد"
                    data={stats.byDepartment}
                    icon={BuildingOffice2Icon}
                    onItemClick={(key) => handleStatClick(`لیست پرسنل واحد: ${key}`, stats.byDepartmentPersonnel[key], 'general')}
                />
                <ChartCard title="آمار بر اساس گروه سنی" data={stats.byAgeGroup} icon={CakeIcon} />
                <HolidayCalendarCard holidayInfo={holidayInfo} />
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
