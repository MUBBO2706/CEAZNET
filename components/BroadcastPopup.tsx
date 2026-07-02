import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { X } from 'lucide-react';

interface Announcement {
    id: string;
    html: string;
}

export const BroadcastPopup: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
    const lastFetchTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!user) {
            // Do NOT fetch broadcasts or establish real-time listeners for anonymous sessions before login
            return;
        }

        // Load unread broadcasts on startup
        const fetchBroadcasts = async (retryWithoutType = false, force = false) => {
            try {
                // Deduplicate fetches/prevent wasting egress on rapid successive mounting or subscription status updates
                const now = Date.now();
                if (!force && !retryWithoutType && now - lastFetchTimeRef.current < 5000) {
                    return;
                }
                if (!retryWithoutType) {
                    lastFetchTimeRef.current = now;
                }

                let query = supabase
                    .from('broadcasts')
                    .select('id, raw_html, expires_at')
                    .eq('status', 'sent')
                    .order('sent_at', { ascending: false, nullsFirst: false })
                    .limit(20);
                
                if (!retryWithoutType) {
                    // Try to fetch with type column and select it
                    query = supabase
                        .from('broadcasts')
                        .select('id, raw_html, expires_at, type')
                        .eq('status', 'sent')
                        .neq('type', 'system_banner')
                        .order('sent_at', { ascending: false, nullsFirst: false })
                        .limit(20);
                }

                const { data, error } = await query;
                
                // If the column 'type' doesn't exist yet, it'll return an error.
                if (error && !retryWithoutType && error.code === '42703') { // 42703 is undefined_column in Postgres
                    return fetchBroadcasts(true);
                } else if (error && !retryWithoutType) {
                    // Try fallback anyway if other error
                    return fetchBroadcasts(true);
                }

                if (!error && data && data.length > 0) {
                    const readIds = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
                    
                    // Find the absolute newest unread and unexpired broadcast
                    const latestUnread = data.find(b => {
                        if (readIds.includes(b.id)) return false;
                        if (b.expires_at && new Date(b.expires_at) < new Date()) return false;
                        return true;
                    });

                    if (latestUnread) {
                        setCurrentAnnouncement({ id: latestUnread.id, html: latestUnread.raw_html });
                        setIsOpen(true);
                    }
                }
            } catch (error) {
                // Squelch verbose warned outputs
            }
        };

        fetchBroadcasts();

        let isUnmounted = false;

        // Listen to Supabase Realtime channels
        const uniqueChannelId = `broadcasts_changes_${Math.random().toString(36).substring(7)}`;
        const channel = supabase.channel(uniqueChannelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'broadcasts' },
                (payload: any) => {
                    if (isUnmounted) return;
                    // Skip updates for system_banners to prevent dual conflicting fetches
                    const record = payload.new || payload.old;
                    if (record && record.type === 'system_banner') {
                        return;
                    }
                    fetchBroadcasts(false, true); // force fetch on actual DB events
                }
            )
            .subscribe((status) => {
                if (isUnmounted) return;
                if (status === 'SUBSCRIBED') {
                    fetchBroadcasts(false, false); // do not force connection-level fetch, let rate limiter handle it
                }
            });

        return () => {
            isUnmounted = true;
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const handleClose = () => {
        if (currentAnnouncement) {
            const readIds = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
            if (!readIds.includes(currentAnnouncement.id)) {
                readIds.push(currentAnnouncement.id);
                localStorage.setItem('read_broadcasts', JSON.stringify(readIds));
            }
        }
        setIsOpen(false);
    };

    useEffect(() => {
        // Expose close function globally so inline HTML onclick="" handles can call it
        (window as any).closeBroadcastPopup = handleClose;
        return () => {
            delete (window as any).closeBroadcastPopup;
        };
    }, [currentAnnouncement]);

    const handleHtmlContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        // Also allow closing if the element has data-close-broadcast attribute
        if (target.closest('[data-close-broadcast="true"]')) {
            handleClose();
        }
    };

    if (!isOpen || !currentAnnouncement) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                onClick={handleClose} 
            />
            <div className="relative z-10 w-full animate-fade-in-up flex flex-col justify-center items-center pointer-events-none">
                {/* Dynamically render raw HTML message sent from admin panel */}
                <div 
                    className="w-full max-w-3xl overflow-y-auto max-h-[85vh] pointer-events-auto"
                    onClick={handleHtmlContentClick}
                    dangerouslySetInnerHTML={{ __html: currentAnnouncement.html }} 
                />
            </div>
        </div>
    );
};

