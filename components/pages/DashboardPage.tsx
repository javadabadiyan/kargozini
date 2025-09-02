import React, { useState, useEffect, useMemo } from 'react';
import type { Personnel } from '../../types';
import { holidays1403, PERSIAN_MONTHS } from '../holidays';
import { UsersIcon, BuildingOffice2Icon, MapPinIcon, HeartIcon, BriefcaseIcon, CalendarDaysIcon, CakeIcon } from '../icons/Icons';

// Helper to convert numbers to Persian digits
const toPersianDigits = (s: string | number | null | undefined): string => {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);
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
    // Helper to convert any Persian digits back to English to ensure parseInt works
    const toEnglish = (s: string) => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

    const year = parseInt(toEnglish(parts.find(p => p.type === 'year')?.value || '0'), 10);
    const month = parseInt(toEnglish(parts.find(p => p.type === 'month')?.value || '0'), 10);
    const day = parseInt(toEnglish(parts.find(p => p.type === 'day')?.value || '0'), 10);

    return { year, month, day };
};

const persianDateToAge = (birthDateStr: string | null | undefined, currentDate: { year: number; month: number; day: number }): number | null => {
    if (!birthDateStr || typeof birthDateStr !== 'string') return null;

    // A more robust regex to handle YYYY/MM/DD or YYYY-MM-DD
    const match = birthDateStr.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!match) return null;
    
    const birthYear = parseInt(match[1], 10);
    const birthMonth = parseInt(match[2], 10);
    const birthDay = parseInt(match[3], 10);

    if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return null;

    let age = currentDate.year - birthYear;

    // Check if birthday has occurred this year. If not, decrement age.
    if (currentDate.month < birthMonth || (currentDate.month === birthMonth && currentDate.day < birthDay)) {
        age--;
    }

    return age < 0 ? 0 : age; // Age can't be negative
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
const StatListCard: React.FC<{ title: string; data: [string, number][]; icon: React.ComponentType<{ className?: string }> }> = ({ title, data, icon: Icon }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md h-full flex flex-col">
        <div className="flex items-center mb-4">
            <Icon className="w-6 h-6 text-gray-500 ml-3" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white">{title}</h3>
        </div>
        <div className="overflow-y-auto flex-1 pr-2">
            <ul className="space-y-3">
                {data.map(([key, value]) => (
                    <li key={key} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{key || 'نامشخص'}</span>
                        <span className="font-semibold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{toPersianDigits(value)}</span>
                    </li>
                ))}
            </ul>
        </div>
    </div>
);

const DashboardPage: React.FC = () => {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
        
        const toSortedArray = (obj: Record<string, number>) => Object.entries(obj).sort(([, a], [, b]) => b - a);
        
        // Age calculations
        const currentDate = getCurrentPersianDate();
        const ages: number[] = [];
        let closeToRetirementCount = 0; // 55-59
        let retiredCount = 0; // 60+
        const ageGroups: Record<string, number> = {
            'زیر ۳۰ سال': 0,
            '۳۱-۴۰ سال': 0,
            '۴۱-۵۰ سال': 0,
            '۵۱-۶۰ سال': 0,
            'بیشتر از ۶۰': 0,
            'نامشخص': 0,
        };

        personnel.forEach(p => {
            const age = persianDateToAge(p.birth_date, currentDate);
            if (age !== null) {
                ages.push(age);
                if (age >= 55 && age < 60) closeToRetirementCount++;
                if (age >= 60) retiredCount++;

                if (age <= 30) ageGroups['زیر ۳۰ سال']++;
                else if (age >= 31 && age <= 40) ageGroups['۳۱-۴۰ سال']++;
                else if (age >= 41 && age <= 50) ageGroups['۴۱-۵۰ سال']++;
                else if (age >= 51 && age <= 60) ageGroups['۵۱-۶۰ سال']++;
                else if (age > 60) ageGroups['بیشتر از ۶۰']++;
            } else {
                ageGroups['نامشخص']++;
            }
        });

        const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;


        return {
            total: personnel.length,
            byDepartment: toSortedArray(groupAndCount('department')),
            byServiceLocation: toSortedArray(groupAndCount('service_location')),
            byPosition: toSortedArray(groupAndCount('position')),
            byMaritalStatus: toSortedArray(groupAndCount('marital_status')),
            averageAge,
            closeToRetirementCount,
            retiredCount,
            byAgeGroup: toSortedArray(ageGroups)
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

    if (loading) {
        return <div className="text-center p-10">در حال بارگذاری اطلاعات داشبورد...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">{error}</div>;
    }
    
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
                <StatCard title="کل پرسنل" value={toPersianDigits(stats?.total || 0)} icon={UsersIcon} color="bg-blue-500" />
                <StatCard title="میانگین سن" value={`${toPersianDigits(stats?.averageAge || 0)} سال`} icon={CakeIcon} color="bg-teal-500" />
                <StatCard title="نزدیک به بازنشستگی" value={toPersianDigits(stats?.closeToRetirementCount || 0)} icon={UsersIcon} color="bg-amber-500" />
                <StatCard title="سن بازنشستگی" value={toPersianDigits(stats?.retiredCount || 0)} icon={UsersIcon} color="bg-red-500" />
                <StatCard title="تعداد واحدها" value={toPersianDigits(stats?.byDepartment.length || 0)} icon={BuildingOffice2Icon} color="bg-green-500" />
                <StatCard title="پرسنل متاهل" value={toPersianDigits(stats?.byMaritalStatus.find(([k]) => k === 'متاهل')?.[1] || 0)} icon={HeartIcon} color="bg-rose-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {stats && <StatListCard title="آمار بر اساس واحد" data={stats.byDepartment} icon={BuildingOffice2Icon} />}
                 {stats && <StatListCard title="آمار بر اساس محل خدمت" data={stats.byServiceLocation} icon={MapPinIcon} />}
                 {stats && <StatListCard title="آمار بر اساس گروه سنی" data={stats.byAgeGroup} icon={CakeIcon} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {stats && <StatListCard title="آمار بر اساس سمت" data={stats.byPosition} icon={BriefcaseIcon} />}
                {stats && <StatListCard title="آمار بر اساس وضعیت تاهل" data={stats.byMaritalStatus} icon={HeartIcon} />}
            </div>
            
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
        </div>
    );
};

export default DashboardPage;
