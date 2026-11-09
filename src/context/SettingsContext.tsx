import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { SchoolSettings } from '../types';
import { getDefaultGatewayToken } from '../utils/security';

interface SettingsContextType {
  settings: SchoolSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SchoolSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: SchoolSettings = {
  schoolName: 'Madapdap Resettlement High School',
  schoolLogo: '/school-logo.svg',
  address: 'Mabalacat City, Pampanga',
  motto: "Excellence, Integrity, and Dedicated Service to Youth & Community",
  resendApiKey: getDefaultGatewayToken(),
  backupResendApiKeys: [],
  timezone: 'Asia/Manila',
  openingTime: '07:00',
  lateCutoff: '07:30',
  closingTime: '17:00',
  schoolDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SchoolSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const settingsRef = doc(db, 'school_settings', 'global');

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<SchoolSettings>;
          // If the database document still has the placeholder demo name, migrate to Madapdap Resettlement High School
          const isPlaceholderName = !data.schoolName || 
            data.schoolName === 'St. Augustine International Academy' || 
            data.schoolName === 'Oakridge Academy';

          const rawLogo = (!data.schoolLogo || data.schoolLogo === '/school-logo.png') ? '/school-logo.svg' : data.schoolLogo;

          const resolved: SchoolSettings = {
            ...DEFAULT_SETTINGS,
            ...data,
            schoolName: isPlaceholderName ? 'Madapdap Resettlement High School' : (data.schoolName || DEFAULT_SETTINGS.schoolName),
            schoolLogo: rawLogo,
            address: data.address || 'Mabalacat City, Pampanga',
            motto: data.motto || "Excellence, Integrity, and Dedicated Service to Youth & Community",
            resendApiKey: (data.resendApiKey && data.resendApiKey.trim() !== '') ? data.resendApiKey : DEFAULT_SETTINGS.resendApiKey,
            backupResendApiKeys: Array.isArray(data.backupResendApiKeys) ? data.backupResendApiKeys : []
          };
          setSettings(resolved);
        } else {
          // Initialize default document
          setDoc(settingsRef, DEFAULT_SETTINGS).catch((e) => {
            console.warn('Initial settings write warning:', e);
          });
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Settings listener error, using defaults:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: Partial<SchoolSettings>) => {
    const settingsRef = doc(db, 'school_settings', 'global');
    const merged = { ...settings, ...newSettings };
    try {
      await setDoc(settingsRef, merged, { merge: true });
      setSettings(merged);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school_settings/global');
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
