import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { DashboardPage } from './components/DashboardPage';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <DashboardPage /> : <LoginPage />;
}

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
