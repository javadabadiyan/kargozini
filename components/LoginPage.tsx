import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import { UserIcon, LockIcon } from './icons';
import type { User } from '../types';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { settings } = useSettings();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/users?module=admin&action=login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await response.text();
      if (!responseText) {
        // Handle empty response from server, which causes the JSON error
        throw new Error('پاسخ نامعتبر از سرور. ممکن است سرور در دسترس نباشد.');
      }
      const data = JSON.parse(responseText);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      login(data as User);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'نام کاربری یا رمز عبور اشتباه است.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Right Panel: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-12">
        <div className="w-full max-w-md">
           <div className="text-center mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              {settings?.app_logo && (
                  <img src={settings.app_logo} alt="App Logo" className="w-24 h-24 mx-auto mb-4 rounded-full object-cover shadow-md"/>
              )}
            <h1 className="text-3xl font-bold text-slate-800">{settings?.app_name || 'سیستم جامع کارگزینی'}</h1>
            <p className="mt-2 text-slate-600">برای ورود به حساب کاربری خود وارد شوید</p>
          </div>
          <form 
            className="space-y-6 animate-fade-in-up" 
            style={{ animationDelay: '200ms' }} 
            onSubmit={handleLogin}
          >
            <div className="relative">
               <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <UserIcon className="w-5 h-5 text-slate-400" />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="w-full px-4 py-3 pr-12 text-slate-900 placeholder-slate-500 bg-slate-100 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                placeholder="نام کاربری"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <LockIcon className="w-5 h-5 text-slate-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full px-4 py-3 pr-12 text-slate-900 placeholder-slate-500 bg-slate-100 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                placeholder="رمز عبور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <div className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:bg-blue-400 disabled:cursor-not-allowed shadow-sm hover:shadow-lg"
              >
                {isLoading ? 'در حال ورود...' : 'ورود'}
              </button>
            </div>
          </form>
           <footer className="text-center py-8 text-slate-500 text-sm animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                طراحی و کدنویسی جواد آبادیان
            </footer>
        </div>
      </div>
      
      {/* Left Panel: Decorative */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-60 h-60 rounded-full bg-blue-500 opacity-30"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-72 h-72 rounded-full bg-indigo-500 opacity-30"></div>
        <div className="z-10 animate-fade-in-up">
            {settings?.app_logo && (
                <img src={settings.app_logo} alt="App Logo" className="w-32 h-32 mx-auto mb-6 rounded-full object-cover border-4 border-white/50 shadow-xl"/>
            )}
          <h2 className="text-4xl font-bold mb-4">{settings?.app_name || 'سیستم جامع کارگزینی'}</h2>
          <p className="text-lg max-w-sm mx-auto opacity-90">
            ابزاری قدرتمند و یکپارچه برای مدیریت کارآمد منابع انسانی سازمان شما.
          </p>
        </div>
      </div>

    </div>
  );
};
