import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import type { AppSettings } from '../types';

interface SettingsContextType {
  settings: AppSettings | null;
  isLoading: boolean;
  updateSettings: (newSettings: AppSettings) => Promise<void>;
  fetchSettings: () => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users?module=admin&action=settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
         // Set default settings if none found
        setSettings({ app_name: 'سیستم جامع کارگزینی', app_logo: null });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setSettings({ app_name: 'سیستم جامع کارگزینی', app_logo: null });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSettings = async (newSettings: AppSettings) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/users?module=admin&action=settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSettings),
        });
        if (!response.ok) throw new Error('Failed to save settings');
        const savedSettings = await response.json();
        setSettings(savedSettings);
    } catch (error) {
        console.error('Failed to update settings:', error);
        throw error; // Re-throw to be caught by the caller
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings, fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};