
import React, { useState, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const handleLogin = useCallback((user: string, pass: string): boolean => {
    // In a real application, this would be an API call.
    // For this demo, we use hardcoded credentials.
    if (user === 'ادمین' && pass === '5221157') {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  return (
    <div className="bg-slate-100 min-h-screen">
      {isAuthenticated ? (
        <DashboardLayout onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
