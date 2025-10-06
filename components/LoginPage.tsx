import React, { useState } from 'react';
import { LockClosedIcon, UserIcon, LoginIcon } from './icons/Icons';

interface LoginPageProps {
  onLogin: (user: string, pass: string) => Promise<{ success: boolean; error?: string }>;
}

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
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4">
      <div className="flex flex-col md:flex-row w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Decorative Panel */}
        <div className="w-full md:w-2/5 p-8 text-white flex flex-col justify-center items-center text-center bg-[linear-gradient(-45deg,#0284c7,#1d4ed8,#4f46e5,#7c3aed)] bg-[size:400%_400%] animate-aurora">
          <h1 className="text-4xl font-bold mb-2">سیستم جامع کارگزینی</h1>
          <p className="text-lg opacity-80 max-w-sm">
            به سیستم یکپارچه مدیریت پرسنل خوش آمدید.
          </p>
        </div>

        {/* Form Panel */}
        <div className="w-full md:w-3/5 bg-white p-8 md:p-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">ورود به سیستم</h2>
          <p className="text-slate-600 mb-8">لطفا برای ورود اطلاعات خود را وارد کنید.</p>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full px-4 py-3 pr-10 text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-slate-500"
                placeholder="نام کاربری"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <LockClosedIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 pr-10 text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-slate-500"
                placeholder="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <div>
              <button
                type="submit"
                className="group w-full flex items-center justify-center gap-2 py-3 text-lg font-bold text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                <LoginIcon className="w-6 h-6 transform transition-transform group-hover:-translate-x-1" />
                {isLoading ? 'در حال بررسی...' : 'ورود'}
              </button>
            </div>
          </form>
          <div className="mt-12 text-center text-sm text-slate-500">
             <p>طراح و کدنویسی جواد آبادیان</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;