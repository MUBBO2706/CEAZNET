import React, { useEffect, useState } from 'react';
import { Clock, MapPin, MonitorSmartphone, MonitorX } from 'lucide-react';
import { getExactDeviceName } from '../utils/deviceUtils';

interface Props {
  isOpen: boolean;
  terminatorDeviceName?: string;
  terminatorLocation?: string;
  terminatorTime?: string | number | Date;
}

const SessionTerminatedModal: React.FC<Props> = ({
  isOpen,
  terminatorDeviceName,
  terminatorLocation,
  terminatorTime,
}) => {
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

      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        dbs.forEach((db) => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      }
    } catch (error) {
      console.warn('Could not fully clear client storage:', error);
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

  const formatTerminationTime = (timeVal?: string | number | Date) => {
    if (!timeVal) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    try {
      const d = new Date(timeVal);
      if (isNaN(d.getTime())) {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
      return isToday ? `Today at ${timeStr}` : `${dateStr}, ${timeStr}`;
    } catch {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  };

  const formattedTime = formatTerminationTime(terminatorTime);
  const locationInfo = terminatorLocation && terminatorLocation !== 'Unknown Location' ? terminatorLocation : null;

  return (
    <div
      id="session-terminated-overlay"
      className="fixed inset-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md flex items-center justify-center z-[99999] p-6 animate-in fade-in duration-200"
    >
      <div
        id="session-terminated-content"
        className="w-full max-w-sm flex flex-col items-center text-center"
        role="dialog"
      >
        <MonitorX className="h-12 w-12 text-red-500 mb-6 drop-shadow-sm" />

        <h2
          id="session-terminated-title"
          className="text-2xl font-bold text-gray-900 dark:text-white mb-3"
        >
          Session Terminated
        </h2>

        <p className="text-gray-600 dark:text-neutral-400 text-sm mb-7 leading-relaxed max-w-[280px]">
          You have been logged out because this session was terminated from another device.
        </p>

        {/* Containerless Termination Metadata */}
        <div
          id="session-terminated-details"
          className="w-full flex flex-col items-center justify-center space-y-2 mb-9 text-xs sm:text-sm text-gray-500 dark:text-neutral-400"
        >
          {/* Terminated by Device */}
          <div className="flex items-center justify-center gap-2 text-center">
            <MonitorSmartphone className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0" />
            <span>
              Terminated by{' '}
              <strong className="text-gray-900 dark:text-neutral-200 font-medium">
                {deviceInfo}
              </strong>
            </span>
          </div>

          {/* Location & Time Info (Containerless) */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-neutral-400">
            {locationInfo && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 shrink-0" />
                <span>{locationInfo}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 shrink-0" />
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>

        <a
          id="session-terminated-return-home-link"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleReload();
          }}
          className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-neutral-300 dark:hover:text-white underline underline-offset-4 decoration-gray-300 hover:decoration-gray-900 dark:decoration-neutral-600 dark:hover:decoration-white transition-colors cursor-pointer"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default SessionTerminatedModal;
