
import { useState, useEffect } from 'react';

interface NetworkStatus {
    isOnline: boolean;
    isSlow: boolean;
    effectiveType?: string;
}

export const useNetworkStatus = (): NetworkStatus => {
    const [status, setStatus] = useState<NetworkStatus>({
        isOnline: navigator.onLine,
        isSlow: false,
    });

    useEffect(() => {
        const updateStatus = () => {
            let isSlow = false;
            // @ts-ignore - Navigator connection is experimental and not in all TS defs
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

            if (connection) {
                // Consider 'slow-2g', '2g', or '3g' as slow
                if (['slow-2g', '2g', '3g'].includes(connection.effectiveType) || connection.saveData) {
                    isSlow = true;
                }
            }

            setStatus({
                isOnline: navigator.onLine,
                isSlow,
                effectiveType: connection?.effectiveType,
            });
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        
        // @ts-ignore
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            connection.addEventListener('change', updateStatus);
        }

        // Initial check
        updateStatus();

        return () => {
            window.removeEventListener('online', updateStatus);
            window.removeEventListener('offline', updateStatus);
            if (connection) {
                connection.removeEventListener('change', updateStatus);
            }
        };
    }, []);

    return status;
};
