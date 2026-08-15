import { useState, useEffect, useRef, useCallback } from 'react';
import { UIPreferences } from '../types';

export type ChargingOverlayState = 'hidden' | 'animating' | 'black-screen';

export const isMobileOrTablet = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
  const isIPadOS = /Macintosh/i.test(ua) && Boolean(navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
  return isMobileUA || isIPadOS;
};

export function useChargingMode(preferences: UIPreferences) {
  const [isSupported, setIsSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return isMobileOrTablet() || 'getBattery' in navigator;
  });
  const [overlayState, setOverlayState] = useState<ChargingOverlayState>('hidden');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevChargingRef = useRef<boolean | null>(null);

  const isEnabled = preferences.chargingModeEnabled ?? true;
  const durationMinutes = preferences.chargingModeDuration ?? 1;
  const useBlackScreen = preferences.chargingModeBlackScreen ?? true;

  const triggerPreview = useCallback(() => {
    setOverlayState('animating');
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      setOverlayState(useBlackScreen ? 'black-screen' : 'hidden');
    }, durationMinutes * 60 * 1000);
  }, [durationMinutes, useBlackScreen]);

  useEffect(() => {
    let batteryManager: any = null;

    const startAnimationTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setOverlayState(useBlackScreen ? 'black-screen' : 'hidden');
      }, durationMinutes * 60 * 1000);
    };

    const handleBatteryChange = (e: Event) => {
      const target = e.target as any;
      const isCharging = Boolean(target.charging);
      const level = typeof target.level === 'number' ? target.level : 1;
      
      setBatteryLevel(level);

      if (!isEnabled) {
        setOverlayState('hidden');
        if (timerRef.current) clearTimeout(timerRef.current);
        prevChargingRef.current = isCharging;
        return;
      }

      const wasCharging = prevChargingRef.current;
      prevChargingRef.current = isCharging;

      if (isCharging) {
        if (wasCharging === false || wasCharging === null) {
          setOverlayState('animating');
          startAnimationTimer();
        }
      } else {
        // Disconnected from charger -> Hide overlay immediately
        setOverlayState('hidden');
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        batteryManager = battery;
        
        const isMobile = isMobileOrTablet();
        const isCharging = Boolean(battery.charging);
        const level = typeof battery.level === 'number' ? battery.level : 1;

        // Check if device is a Desktop PC (No battery hardware, permanent fixed dummy values)
        const isDesktopPC = !isMobile &&
          isCharging &&
          level === 1 &&
          battery.chargingTime === 0 &&
          (battery.dischargingTime === Infinity || battery.dischargingTime === null);

        if (isDesktopPC) {
          // Desktop PC detected -> Disable charging mode and hide from settings
          setIsSupported(false);
          setOverlayState('hidden');
          prevChargingRef.current = true;
          return;
        }

        setIsSupported(true);
        setBatteryLevel(level);
        prevChargingRef.current = isCharging;

        // For mobile / tablets / active battery devices:
        // If charger is ALREADY connected on page load, trigger the animation!
        if (isEnabled && isCharging) {
          if (isMobile || level < 1) {
            setOverlayState('animating');
            startAnimationTimer();
          }
        }

        battery.addEventListener('chargingchange', handleBatteryChange);
        battery.addEventListener('levelchange', handleBatteryChange);
      }).catch(() => {
        setIsSupported(false);
      });
    } else {
      setIsSupported(false);
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
    batteryLevel,
    triggerPreview
  };
}

