import React, { useState } from 'react';
import { LockClosedIcon, UserIcon, LoginIcon, UsersIcon } from './icons/Icons';

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
    <div className="flex min-h-screen w-full items-center justify-center bg-transparent p-4 relative overflow-hidden">
        {/* Animated Shapes */}
        <div className="absolute inset-0 z-[-1] pointer-events-none">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 rounded-full filter blur-3xl opacity-40 bg-shape" />
            <div className="absolute top-60 -right-40 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full filter blur-3xl opacity-30 bg-shape2" />
        </div>

        {/* Glassmorphism Login Card */}
        <div className="w-full max-w-md rounded-2xl border border-white/20 dark:border-slate-700/50 bg-white/30 dark:bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-8">
                <div className="inline-block bg-white/20 dark:bg-slate-800/50 p-4 rounded-full mb-4 ring-1 ring-white/10">
                    <UsersIcon className="w-12 h-12 text-blue-500" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">ورود به سیستم</h2>
                <p className="text-slate-600 dark:text-slate-300 mt-2">خوش آمدید، لطفا وارد شوید.</p>
            </div>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="relative">
                    <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                        id="username"
                        name="username"
                        type="text"
                        required
                        className="w-full px-4 py-3 pr-10 text-slate-800 dark:text-white bg-white/20 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-500 dark:placeholder:text-slate-400"
                        placeholder="نام کاربری"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                    />
                </div>
                <div className="relative">
                    <LockClosedIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        className="w-full px-4 py-3 pr-10 text-slate-800 dark:text-white bg-white/20 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-500 dark:placeholder:text-slate-400"
                        placeholder="رمز عبور"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                {error && (
                    <div className="text-red-500 dark:text-red-400 text-sm text-center bg-red-100/50 dark:bg-red-900/30 p-2 rounded-md">{error}</div>
                )}

                <div>
                    <button
                        type="submit"
                        className="group w-full flex items-center justify-center gap-2 py-3 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-4 focus:ring-offset-slate-900/50 focus:ring-blue-500 transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        <LoginIcon className="w-6 h-6 transform transition-transform group-hover:-translate-x-1" />
                        {isLoading ? 'در حال ورود...' : 'ورود به سیستم'}
                    </button>
                </div>
            </form>
            <div className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
                <p>طراح و کدنویسی جواد آبادیان</p>
            </div>
        </div>
    </div>
  );
};

export default LoginPage;
