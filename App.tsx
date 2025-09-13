import React, { useState, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import type { UserPermissions } from './types';

interface CurrentUser {
  username: string;
  permissions: UserPermissions;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const storedUser = sessionStorage.getItem('currentUser');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      console.error("Failed to parse user from sessionStorage", e);
      return null;
    }
  });

  const handleLogin = useCallback(async (user: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const userData: CurrentUser = {
          username: data.user.username,
          permissions: data.user.permissions,
        };
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        setCurrentUser(userData);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'نام کاربری یا رمز عبور اشتباه است.' };
      }
    } catch (error) {
      console.error('Login request failed:', error);
      return { success: false, error: 'خطا در برقراری ارتباط با سرور.' };
    }
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
  }, []);

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-200">
      {currentUser ? (
        <DashboardLayout onLogout={handleLogout} user={currentUser} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;