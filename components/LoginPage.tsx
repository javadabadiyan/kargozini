import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { LockClosedIcon, UserIcon, LoginIcon } from './icons/Icons';

interface LoginPageProps {
  onLogin: (user: string, pass: string) => Promise<{ success: boolean; error?: string }>;
}

const AnimatedBackground: React.FC = () => (
  <div className="absolute inset-0 z-0 overflow-hidden">
    <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-500/10 rounded-full filter blur-3xl opacity-60 bg-shape" />
    <div className="absolute top-40 -right-20 w-96 h-96 bg-indigo-500/10 rounded-full filter blur-3xl opacity-50 bg-shape2" />
    <div className="absolute bottom-0 -left-10 w-80 h-80 bg-sky-500/10 rounded-full filter blur-3xl opacity-70 bg-shape3" />
  </div>
);

const AnimatedDigit: React.FC<{ digit: string; hasChanged: boolean }> = memo(({ digit, hasChanged }) => {
  return (
    <span className={`inline-block ${hasChanged ? 'digit-animate' : ''}`}>
      {digit}
    </span>
  );
});

const Clock: React.FC<{size?: 'sm' | 'md' | 'lg'}> = ({ size = 'lg' }) => {
    const [timeString, setTimeString] = useState('');
    const previousTimeRef = useRef('');

    const toPersianDigits = (s: string) => s.replace(/[0-9]/g, (w) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(w, 10)]);

    const timeFormatter = useMemo(() => new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: 'Asia/Tehran'
    }), []);

    useEffect(() => {
        // Set initial time
        setTimeString(timeFormatter.format(new Date()));

        const timerId = setInterval(() => {
            setTimeString(timeFormatter.format(new Date()));
        }, 1000);
        
        return () => clearInterval(timerId);
    }, [timeFormatter]);
    
    useEffect(() => {
      previousTimeRef.current = timeString;
    });

    const formattedTime = toPersianDigits(timeString);
    const previousFormattedTime = toPersianDigits(previousTimeRef.current);
    
    const textSize = size === 'lg' ? 'text-6xl' : size === 'md' ? 'text-5xl' : 'text-xl';
    const justification = size === 'lg' ? 'justify-end' : 'justify-center';
    const marginBottom = size === 'sm' ? 'mb-1' : 'mb-4';

    return (
        <div className={`${marginBottom} flex ${justification} text-slate-700 dark:text-slate-200`}>
            <div className={`${textSize} font-bold tracking-widest`} dir="ltr" style={{ textShadow: '0 0 10px rgba(71, 145, 255, 0.4)' }}>
                {formattedTime.split('').map((char, index) => {
                    const hasChanged = formattedTime[index] !== previousFormattedTime[index];
                    return char === ':' ?
                        <span key={index} className="px-1 opacity-50 animate-pulse">:</span> :
                        <AnimatedDigit key={`${index}-${char}`} digit={char} hasChanged={hasChanged} />;
                })}
            </div>
        </div>
    );
};


const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await onLogin(username, password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'نام کاربری یا رمز عبور اشتباه است.');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <AnimatedBackground />

      <main className="relative z-10 w-full max-w-6xl px-4">
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          
          <div className="hidden md:block text-right space-y-6">
             <div className="flex items-center justify-end gap-3 pt-20">
               <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent dark:from-sky-400 dark:to-blue-500">
                 سیستم جامع کارگزینی
               </h1>
                <svg className="w-16 h-16 text-blue-600 dark:text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
            </div>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-md ml-auto">
              به سیستم یکپارچه مدیریت پرسنل خوش آمدید. برای دسترسی به امکانات، لطفاً وارد حساب کاربری خود شوید.
            </p>
          </div>

          <div className="w-full max-w-md p-8 space-y-8 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 mx-auto">
            <div className="text-center">
               <div className="flex items-center justify-center gap-3 mb-4 md:hidden">
                 <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent dark:from-sky-400 dark:to-blue-500">
                   سیستم جامع کارگزینی
                 </h1>
                  <svg className="w-10 h-10 text-blue-600 dark:text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400">لطفا برای ورود اطلاعات خود را وارد کنید</p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="relative">
                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="w-full px-4 py-3 pr-10 text-gray-700 bg-slate-100/50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder:text-gray-400"
                  placeholder="نام کاربری"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="relative">
                <LockClosedIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full px-4 py-3 pr-10 text-gray-700 bg-slate-100/50 dark:bg-slate-700/50 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white placeholder:text-gray-400"
                  placeholder="رمز عبور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="text-red-500 dark:text-red-400 text-sm text-center">{error}</div>
              )}

              <div>
                <button
                  type="submit"
                  className="group w-full flex items-center justify-center gap-2 py-3 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  <LoginIcon className="w-6 h-6 transform transition-transform group-hover:-translate-x-1" />
                  {isLoading ? 'در حال بررسی...' : 'ورود به سیستم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <footer className="absolute bottom-4 text-center w-full z-10">
        <Clock size="sm" />
        <p className="text-sm text-slate-500 dark:text-slate-400">طراح و کدنویسی جواد آبادیان</p>
      </footer>
    </div>
  );
};

export default LoginPage;