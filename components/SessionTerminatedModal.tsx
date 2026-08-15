import React, { useEffect, useState } from 'react';
import { LogOut, MonitorSmartphone, MonitorX } from 'lucide-react';
import { getExactDeviceName } from '../utils/deviceUtils';

interface Props {
  isOpen: boolean;
  terminatorDeviceName?: string;
}

const SessionTerminatedModal: React.FC<Props> = ({ isOpen, terminatorDeviceName }) => {
  const [deviceInfo, setDeviceInfo] = useState<string>('Unknown Device');

  useEffect(() => {
    const fetchExactDevice = async () => {
      if (terminatorDeviceName) {
        setDeviceInfo(terminatorDeviceName);
      } else {
        const name = await getExactDeviceName();
        setDeviceInfo(name);
      }
    };
    if (isOpen) {
      fetchExactDevice();
    }
  }, [isOpen, terminatorDeviceName]);

  const handleReload = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        dbs.forEach(db => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      }
    } catch (error) {
      console.warn("Could not fully clear client storage:", error);
    } finally {
      window.location.replace('/');
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md flex items-center justify-center z-[99999] p-6 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm flex flex-col items-center text-center"
        role="dialog"
      >
        <MonitorX className="h-12 w-12 text-red-500 mb-6 drop-shadow-sm" />
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Session Ended
        </h2>
        
        <p className="text-gray-600 dark:text-neutral-400 text-sm mb-8 leading-relaxed max-w-[280px]">
          You have been logged out because this session was terminated from another device.
        </p>
        
        <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-neutral-500 text-sm mb-10 bg-gray-50 dark:bg-neutral-900/50 px-4 py-2 rounded-full border border-gray-100 dark:border-neutral-800">
          <MonitorSmartphone className="w-4 h-4" />
          <span>Terminated by <strong className="text-gray-800 dark:text-neutral-300 font-medium">{deviceInfo}</strong></span>
        </div>
        
        <button
          onClick={handleReload}
          className="w-full max-w-[240px] flex items-center justify-center bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 py-3 px-6 rounded-full font-semibold transition-all active:scale-95 shadow-sm"
        >
          Return to Login
        </button>
      </div>
    </div>
  );
};

export default SessionTerminatedModal;
