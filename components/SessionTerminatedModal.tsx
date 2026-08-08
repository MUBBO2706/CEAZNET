import React, { useEffect, useState } from 'react';
import { ShieldAlert, RotateCcw, MonitorSmartphone, WifiOff, Cpu } from 'lucide-react';
import { getExactDeviceName } from '../utils/deviceUtils';

interface Props {
  isOpen: boolean;
  terminatorDeviceName?: string;
}

const SessionTerminatedModal: React.FC<Props> = ({ isOpen, terminatorDeviceName }) => {
  const [deviceInfo, setDeviceInfo] = useState<string>('Unknown Node');
  const [isHovering, setIsHovering] = useState(false);

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
    <div className="fixed inset-0 bg-neutral-900/95 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-300">
      <div 
        className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-[420px] transform transition-all flex flex-col items-center p-8 text-center relative overflow-hidden" 
        role="dialog"
      >
        {/* Icon Container bg-neutral-900 */}
        <div className="relative z-10 h-24 w-24 rounded-full bg-neutral-900 flex items-center justify-center mb-6 ring-4 ring-neutral-800 shrink-0">
          <ShieldAlert className="h-10 w-10 text-red-500 relative z-10" />
        </div>
        
        {/* Text Content */}
        <div className="relative z-10 w-full">
          <h2 className="text-2xl font-bold text-white mb-2 tracking-wide font-sans">
            Session Terminated
          </h2>
          <p className="text-red-400 mb-6 font-mono text-[11px] uppercase tracking-wider">Security Protocol Engaged</p>
          
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-5 mb-6 text-left">
            <div className="flex gap-4 items-start mb-4">
              <WifiOff className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-neutral-300 text-sm leading-relaxed">
                Critical override detected. Your session was force-closed remotely or accessed from an unauthorized node. This connection has been severed.
              </p>
            </div>

            <div className="border-t border-neutral-800 pt-4 mt-2">
              <div className="flex items-center gap-3 text-neutral-400 mb-2">
                <MonitorSmartphone className="w-4 h-4" />
                <span className="font-mono text-[10px] uppercase">Target Node Identified:</span>
              </div>
              <div className="bg-black/50 border border-neutral-800 rounded p-3 font-mono text-xs text-neutral-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-neutral-500" />
                <span className="truncate">{deviceInfo}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleReload}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white py-3.5 px-6 rounded-lg font-semibold transition-all active:scale-[0.98] group overflow-hidden relative"
          >
            <RotateCcw className={`w-4 h-4 transition-transform duration-500 ${isHovering ? '-rotate-180' : ''}`} />
            <span className="tracking-wide text-sm">Reboot Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTerminatedModal;
