import { useState, useEffect, useRef } from 'react';
import { UIPreferences } from '../types';

export type ChargingOverlayState = 'hidden' | 'animating' | 'black-screen';

export function useChargingMode(preferences: UIPreferences) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [overlayState, setOverlayState] = useState<ChargingOverlayState>('hidden');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isEnabled = preferences.chargingModeEnabled ?? true;
  const durationMinutes = preferences.chargingModeDuration ?? 1;
  const useBlackScreen = preferences.chargingModeBlackScreen ?? true;

  useEffect(() => {
    let batteryManager: any = null;

    const updateState = (isCharging: boolean, level: number) => {
      setBatteryLevel(level);

      if (!isEnabled) {
        setOverlayState('hidden');
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }

      if (isCharging) {
        setOverlayState((prev) => {
          if (prev !== 'hidden') return prev;
          if (timerRef.current) clearTimeout(timerRef.current);
          
          timerRef.current = setTimeout(() => {
            setOverlayState(useBlackScreen ? 'black-screen' : 'hidden');
          }, durationMinutes * 60 * 1000);
          
          return 'animating';
        });
      } else {
        setOverlayState('hidden');
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };

    const handleBatteryChange = (e: Event) => {
      const target = e.target as any;
      updateState(target.charging, target.level);
    };

    if ('getBattery' in navigator) {
      setIsSupported(true);
      (navigator as any).getBattery().then((battery: any) => {
        batteryManager = battery;
        updateState(battery.charging, battery.level);
        
        battery.addEventListener('chargingchange', handleBatteryChange);
        battery.addEventListener('levelchange', handleBatteryChange);
      }).catch(() => {
        setIsSupported(false);
      });
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('chargingchange', handleBatteryChange);
        batteryManager.removeEventListener('levelchange', handleBatteryChange);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isEnabled, durationMinutes, useBlackScreen]);

  return {
    isSupported,
    overlayState,
    batteryLevel
  };
}
