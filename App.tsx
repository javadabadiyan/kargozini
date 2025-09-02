
import React, { useState, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';

const App: React.FC = () => {
  // Initialize state from sessionStorage to persist login across page reloads.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    sessionStorage.getItem('isLoggedIn') === 'true'
  );

  const handleLogin = useCallback((user: string, pass: string): boolean => {
    // In a real application, this would be an API call.
    // For this demo, we use hardcoded credentials.
    if (user === 'ادمین' && pass === '5221157') {
      // Persist login state in sessionStorage
      sessionStorage.setItem('isLoggedIn', 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    // Clear login state from sessionStorage
    sessionStorage.removeItem('isLoggedIn');
    setIsAuthenticated(false);
  }, []);

  return (
    <div className="bg-slate-100 dark:bg-slate-900 min-h-screen">
      {isAuthenticated ? (
        <DashboardLayout onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;