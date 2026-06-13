import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

// Capture the initial URL before components or Supabase strip it.
// This prevents cross-tab state syncing from showing the password reset popup in old tabs.
const initialHash = window.location.hash;
const initialSearch = window.location.search;
const isRecoveryLink = initialHash.includes('type=recovery') || initialSearch.includes('type=recovery');

export const useAuth = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [authEvent, setAuthEvent] = useState<string | null>(null);

    useEffect(() => {
        // Fallback for detecting recovery in case we miss the event or React batches state updates
        if (isRecoveryLink) {
            setAuthEvent('PASSWORD_RECOVERY');
        }

        const getSession = async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error getting session:", error);
                return;
            }
            setSession(data.session);
            setUser(data.session?.user ?? null);
        };

        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    // Only honor the event if this tab actually navigated to the recovery URL.
                    // This prevents the 'Update Password' modal from popping up in other open tabs.
                    if (isRecoveryLink) {
                        setAuthEvent('PASSWORD_RECOVERY');
                    }
                } else {
                    // Don't overwrite PASSWORD_RECOVERY if it just happened
                    setAuthEvent(prev => prev === 'PASSWORD_RECOVERY' ? prev : event);
                }
                setSession(session);
                setUser(session?.user ?? null);
            }
        );

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, []);

    const logout = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Error logging out:", error);
        }
    }, []);

    return {
        session,
        user,
        authEvent,
        logout
    };
};
