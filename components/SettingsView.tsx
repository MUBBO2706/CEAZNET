import React, { useState, useEffect, useRef } from "react";
import { UIPreferences, UserProfile, View } from "../types";
import {
  Type,
  Monitor,
  Sun,
  Moon,
  Trash2,
  Key,
  Palette,
  Cpu,
  Layout,
  Maximize,
  Minimize,
  ShieldCheck,
  Smartphone,
  Laptop,
  Globe,
  RotateCw,
  Loader2,
  LogOut,
  Clock,
  Lock,
  Shield,
  Calendar,
  Fingerprint,
  BatteryMedium,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import ConfirmationModal from "./ConfirmationModal";
import ApiKeyModal from "./ApiKeyModal";
import { getSetting } from "../services/dbService";
import { getExactDeviceName } from "../utils/deviceUtils";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../services/supabaseClient";
import metadata from "../metadata.json";
import packageInfo from "../package.json";

const getRelativeDateAnd24hTime = (dateInput: string | number | Date | null | undefined) => {
  if (!dateInput) return { relativeDate: '-', time24h: '-', exactString: '-' };
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return { relativeDate: '-', time24h: '-', exactString: '-' };

  // Format 24-hour time in Asia/Kolkata timezone exactly like DevTools
  const time24h = d.toLocaleTimeString('en-GB', { 
    timeZone: 'Asia/Kolkata', 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: false 
  });

  // Exact Date string e.g., "2 June 26, 14:30:15"
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Kolkata' });
  const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Kolkata' });
  const year = d.toLocaleDateString('en-GB', { year: '2-digit', timeZone: 'Asia/Kolkata' });
  const exactString = `${day} ${month} ${year}, ${time24h}`;

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relativeDate = '';
  if (diffMs < 0) {
    relativeDate = 'Today';
  } else if (diffDays === 0) {
    relativeDate = 'Today';
  } else if (diffDays === 1) {
    relativeDate = 'Yesterday';
  } else if (diffDays < 7) {
    relativeDate = `${diffDays} days ago`;
  } else if (diffDays >= 7 && diffDays < 14) {
    relativeDate = '1 week ago';
  } else if (diffDays >= 14 && diffDays < 21) {
    relativeDate = '2 weeks ago';
  } else if (diffDays >= 21 && diffDays < 30) {
    relativeDate = '3 weeks ago';
  } else if (diffDays >= 30 && diffDays < 60) {
    relativeDate = '1 month ago';
  } else if (diffDays >= 60 && diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    relativeDate = `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    relativeDate = years === 1 ? '1 year ago' : `${years} years ago`;
  }

  return { relativeDate, time24h, exactString };
};

const RelativeTimestamp: React.FC<{ dateInput: string | number | Date | null | undefined }> = ({ dateInput }) => {
  const [showExact, setShowExact] = useState(false);
  const { relativeDate, time24h, exactString } = getRelativeDateAnd24hTime(dateInput);

  if (relativeDate === '-') return <span>-</span>;

  return (
    <span 
      className="cursor-pointer select-none relative group/ts text-gray-900 dark:text-white font-semibold whitespace-nowrap"
      onClick={(e) => {
        e.stopPropagation();
        setShowExact(!showExact);
      }}
      title="Tap/Hover to view exact time"
    >
      <span className="group-hover/ts:hidden inline">
        {showExact ? exactString : `${relativeDate} at ${time24h}`}
      </span>
      <span className="hidden group-hover/ts:inline">
        {exactString}
      </span>
    </span>
  );
};

interface SettingsViewProps {
  onBack: () => void;
  onNavigate: (view: View) => void;
  preferences: UIPreferences;
  onUpdatePreferences: (newPrefs: Partial<UIPreferences>) => void;
  currentTheme: "light" | "dark" | "system";
  onThemeChange: (theme: "light" | "dark" | "system") => void;
  userProfile?: UserProfile;
  onEditProfile: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onUpdatePreferences,
  currentTheme,
  onThemeChange,
  userProfile,
  onEditProfile,
  onNavigate,
}) => {
  const { user, session, logout, isLoggingOut } = useAuth();
  const [isSigningOutLocal, setIsSigningOutLocal] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOutLocal || isLoggingOut) return;
    setIsSigningOutLocal(true);
    try {
      await logout();
    } catch (err) {
      console.error("Failed to sign out:", err);
      setIsSigningOutLocal(false);
    }
  };

  const formatSessionDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${datePart} at ${timePart}`;
    } catch {
      return dateStr;
    }
  };
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [terminatedSessions, setTerminatedSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isTerminatingId, setIsTerminatingId] = useState<string | null>(null);
  const [confirmTerminateId, setConfirmTerminateId] = useState<string | null>(
    null,
  );
  const [isTerminating, setIsTerminating] = useState(false);

  const [systemInfo, setSystemInfo] = useState({
    os: 'Unknown',
    browser: 'Unknown',
    screen: '',
    network: 'Online',
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    let os = 'Unknown OS';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    if (ua.indexOf('Mac') !== -1) os = 'MacOS';
    if (ua.indexOf('Linux') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('like Mac') !== -1) os = 'iOS';

    let browser = 'Unknown Browser';
    if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
    else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
    if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
    if (ua.indexOf('Edge') !== -1) browser = 'Edge';

    setSystemInfo({
        os,
        browser,
        screen: `${window.innerWidth} × ${window.innerHeight}`,
        network: navigator.onLine ? 'Online' : 'Offline'
    });

    const handleResize = () => setSystemInfo(prev => ({...prev, screen: `${window.innerWidth} × ${window.innerHeight}`}));
    const handleOnline = () => setSystemInfo(prev => ({...prev, network: 'Online'}));
    const handleOffline = () => setSystemInfo(prev => ({...prev, network: 'Offline'}));

    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, []);

  const isFetchingRef = useRef(false);
  const lastSessionKeyLoadedRef = useRef<string | null>(null);

  const loadSessions = async (forceRefetch = false) => {
    if (!user || !session) return;
    // Prevent concurrent twin fetches due to rapid React state adjustments,
    // and bypass if we already have the session active listing successfully loaded.
    if (!forceRefetch && isFetchingRef.current) return;
    if (
      !forceRefetch &&
      lastSessionKeyLoadedRef.current === session.access_token
    )
      return;

    isFetchingRef.current = true;
    setIsLoadingSessions(true);
    try {
      const response = await fetch("/api/sessions", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (response.ok) {
        const { data } = await response.json();
        const loadedSessions = data || [];
        setSessions(loadedSessions);

        // Remove from terminatedSessions if they are active/present in the fetched active sessions
        const activeIds = new Set(
          loadedSessions
            .filter((s: any) => s.session_key && !s.session_key.startsWith("TERMINATED_") && !s.session_key.startsWith("LOGGED_OUT_"))
            .map((s: any) => s.id)
        );
        if (activeIds.size > 0) {
          setTerminatedSessions((prev) => prev.filter((s) => !activeIds.has(s.id)));
        }

        lastSessionKeyLoadedRef.current = session.access_token;
      }
    } catch (e) {
      console.error("Failed to load active sessions:", e);
    } finally {
      setIsLoadingSessions(false);
      isFetchingRef.current = false;
    }
  };

  const handleTerminateSession = async (id: string, isCurrent: boolean) => {
    if (!session) return;
    setIsTerminatingId(id);
    try {
      const terminator_device_name = await getExactDeviceName();
      const response = await fetch("/api/sessions?action=terminate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, terminator_device_name }),
      });
      if (response.ok) {
        const sessionObj = sessions.find((s) => s.id === id);
        if (sessionObj) {
          setTerminatedSessions((prev) => [...prev, { ...sessionObj, is_terminated_local: true }]);
        }
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (isCurrent) {
          logout();
        }
      }
    } catch (e) {
      console.error("Failed to terminate session:", e);
    } finally {
      setIsTerminatingId(null);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!session) return;
    try {
      const response = await fetch("/api/sessions?action=delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        setTerminatedSessions((prev) => prev.filter((s) => s.id !== id));
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  };

  useEffect(() => {
    if (!user || !session) return;

    loadSessions();

    const channel = supabase.channel(`settings-sessions-${user.id}`).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "user_sessions",
        filter: `user_id=eq.${user.id}`,
      },
      (payload: any) => {
        // If payload contains a new user_id and it's not the current user, skip it.
        // For DELETE events, payload.new is null/empty and payload.old only contains the primary key (id), 
        // so we don't skip it, because we can filter by session ID.
        if (payload.new && payload.new.user_id && payload.new.user_id !== user.id) {
          return;
        }

        console.log("[Realtime Sessions] Event received:", payload);

        if (payload.eventType === "INSERT") {
          const newSession = {
            ...payload.new,
            last_login_at: user.last_sign_in_at || payload.new.last_active_at || payload.new.created_at,
          };
          const isTerminated = newSession.session_key && newSession.session_key.startsWith("TERMINATED_");
          const isLoggedOut = newSession.session_key && newSession.session_key.startsWith("LOGGED_OUT_");
          
          if (!isTerminated && !isLoggedOut) {
            setTerminatedSessions((prev) => prev.filter((s) => s.id !== newSession.id));
          }

          setSessions((prev) => {
            if (prev.some((s) => s.id === newSession.id)) {
              return prev.map((s) => (s.id === newSession.id ? { ...s, ...newSession } : s));
            }
            return [newSession, ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          const updatedSession = {
            ...payload.new,
            last_login_at: user.last_sign_in_at || payload.new.last_active_at || payload.new.created_at,
          };
          const isTerminated = updatedSession.session_key && updatedSession.session_key.startsWith("TERMINATED_");
          const isLoggedOut = updatedSession.session_key && updatedSession.session_key.startsWith("LOGGED_OUT_");
          
          if (!isTerminated && !isLoggedOut) {
            setTerminatedSessions((prev) => prev.filter((s) => s.id !== updatedSession.id));
          }

          setSessions((prev) => {
            if (prev.some((s) => s.id === updatedSession.id)) {
              return prev.map((s) => (s.id === updatedSession.id ? { ...s, ...updatedSession } : s));
            } else if (!isTerminated && !isLoggedOut) {
              return [updatedSession, ...prev];
            }
            return prev;
          });
        } else if (payload.eventType === "DELETE") {
          setSessions((prev) => prev.filter((s) => s.id !== payload.old.id));
          setTerminatedSessions((prev) => prev.filter((s) => s.id !== payload.old.id));
        }

        // Also fetch from backend to ensure we have the fully enriched sessions and consistency
        loadSessions(true);
      },
    );

    channel.subscribe((status: string, err?: any) => {
      console.log(`[Realtime Sessions] Subscription status for ${user.id}:`, status, err);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (!user) return;
    getSetting<string>("ceaznet_api_key", user).then((storedKey) => {
      if (storedKey) setApiKey(storedKey);
    });
  }, [user?.id]);

  const handleClearData = () => {
    setIsResetting(true);
    setTimeout(() => {
        localStorage.removeItem("ceaznet_active_conversation_id");
        localStorage.removeItem("ceaznet_ui_preferences");
        window.location.reload();
    }, 400);
  };

  const handleApiKeyUpdate = (newKey: string) => {
    window.dispatchEvent(new CustomEvent("update-api-key", { detail: newKey }));
    setApiKey(newKey);
    setIsApiKeyModalOpen(false);
  };

  const fonts = [
    { id: "sans", label: "Geist Sans", class: "font-sans" },
    { id: "inter", label: "Inter", class: "font-inter" },
    { id: "quicksand", label: "Quicksand", class: "font-quicksand" },
    { id: "serif", label: "Source Serif", class: "font-serif" },
    { id: "playfair", label: "Playfair", class: "font-playfair" },
    { id: "mono", label: "JetBrains", class: "font-mono" },
  ];

  const radii = [
    { id: "small", label: "Sharp", radius: "4px" },
    { id: "medium", label: "Soft", radius: "8px" },
    { id: "large", label: "Round", radius: "16px" },
    { id: "full", label: "Full", radius: "24px" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <>
      <motion.main
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative z-10 h-full overflow-y-auto bg-gray-50 dark:bg-black transition-colors duration-300 pt-16 sm:pt-18 md:pt-20 pb-6 dev-console-spacing-pb"
      >
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-2 sm:py-4 space-y-6 sm:space-y-8">
          {/* --- SECTION 1: PROFILE --- */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-between gap-5 py-2"
          >
            <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-1 shadow-md">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                    {userProfile?.avatar_url ? (
                      <img
                        src={userProfile.avatar_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-indigo-500 to-purple-600">
                        {userProfile?.full_name?.[0].toUpperCase() ||
                          user?.email?.[0].toUpperCase() ||
                          "U"}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`absolute bottom-1 right-1 w-3.5 h-3.5 border-2 border-white dark:border-black rounded-full ${user ? "bg-emerald-500" : "bg-gray-400"}`}
                />
              </div>

              <div className="text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1">
                  {user
                    ? userProfile?.full_name || user?.email?.split("@")[0]
                    : "Guest User"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-white/60 font-medium">
                  {user ? user?.email : "Sign in to sync your data"}
                </p>
                {user?.last_sign_in_at && (
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-1 flex items-center gap-1">
                    Last sign in:{" "}
                    {new Date(user.last_sign_in_at).toLocaleString(
                      undefined,
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      },
                    )}
                  </p>
                )}
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                <button
                  onClick={onEditProfile}
                  disabled={isSigningOutLocal || isLoggingOut}
                  className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-sm active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <User className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOutLocal || isLoggingOut}
                  className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-semibold bg-gray-100 dark:bg-white/5 text-red-600 dark:text-red-400 border border-gray-200/80 dark:border-white/10 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]"
                >
                  {(isSigningOutLocal || isLoggingOut) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      <span>Signing Out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 2 & 3: APPEARANCE & INTERFACE (SIDE-BY-SIDE ON DESKTOP) --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 items-stretch">
            {/* --- SECTION 2: APPEARANCE --- */}
            <motion.div variants={itemVariants} className="space-y-5 w-full flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="p-2 bg-purple-100 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                      Appearance
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-white/50 leading-tight mt-0.5">
                      Select your preferred color theme
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 w-full">
                  {[
                    { id: "light", icon: Sun, label: "Light" },
                    { id: "system", icon: Monitor, label: "Auto" },
                    { id: "dark", icon: Moon, label: "Dark" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onThemeChange(t.id as any)}
                      className={`
                        relative flex flex-col items-center justify-center py-4 px-2 rounded-2xl border transition-all duration-200
                        ${
                          currentTheme === t.id
                            ? "bg-purple-50 dark:bg-purple-500/10 border-purple-500 shadow-sm"
                            : "bg-gray-100/70 dark:bg-white/5 border-transparent hover:bg-gray-200/60 dark:hover:bg-white/10"
                        }
                      `}
                    >
                      <t.icon
                        className={`w-6 h-6 mb-2 ${currentTheme === t.id ? "text-purple-600 dark:text-purple-400" : "text-gray-500 dark:text-white/60"}`}
                      />
                      <span
                        className={`text-xs font-semibold ${currentTheme === t.id ? "text-purple-700 dark:text-purple-300" : "text-gray-600 dark:text-white/60"}`}
                      >
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Details / Summary Card to Balance Desktop Layout */}
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 space-y-2.5 mt-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-white/50 font-medium">Active Theme</span>
                  <span className="font-semibold text-purple-600 dark:text-purple-400 capitalize flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {currentTheme === "system" ? "System Default" : `${currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)} Mode`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-gray-200/50 dark:border-white/5 pt-2">
                  <span className="text-gray-500 dark:text-white/50 font-medium">Preference Source</span>
                  <span className="text-gray-800 dark:text-white/80 font-medium">
                    {currentTheme === "system" ? "OS / Browser Dynamic" : "Manual Override"}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* --- SECTION 3: INTERFACE --- */}
            <motion.div variants={itemVariants} className="space-y-5 w-full">
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                    Interface
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-white/50 leading-tight mt-0.5">
                    Configure layout density and corner radius styling
                  </p>
                </div>
              </div>

              <div className="space-y-5 w-full">
                {/* Density Option */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      Density
                    </span>
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      Choose comfort or compact spacing
                    </p>
                  </div>
                  <div className="p-1.5 bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 rounded-2xl flex items-center gap-1 self-start sm:self-auto">
                    {["comfortable", "compact"].map((layout) => (
                      <button
                        key={layout}
                        onClick={() =>
                          onUpdatePreferences({ layoutDensity: layout as any })
                        }
                        className={`
                          px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-2
                          ${
                            preferences.layoutDensity === layout
                              ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm border border-black/5 dark:border-white/10"
                              : "text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
                          }
                        `}
                      >
                        {layout === "comfortable" ? (
                          <Maximize className="w-4 h-4" />
                        ) : (
                          <Minimize className="w-4 h-4" />
                        )}
                        <span className="capitalize">{layout}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corners Option */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                      Corners
                    </span>
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      Select corner radius treatment
                    </p>
                  </div>
                  <div className="p-1.5 bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 rounded-2xl flex items-center gap-2 self-start sm:self-auto">
                    {radii.map((r) => (
                      <button
                        key={r.id}
                        onClick={() =>
                          onUpdatePreferences({ borderRadius: r.id as any })
                        }
                        className={`
                          w-11 h-11 rounded-xl border transition-all flex items-center justify-center p-1 relative
                          ${
                            preferences.borderRadius === r.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                              : "border-transparent bg-white/60 dark:bg-white/5 text-gray-400 dark:text-white/40 hover:bg-white dark:hover:bg-white/10"
                          }
                        `}
                        title={r.label}
                      >
                        <div
                          className="w-5 h-5 border-2 border-current opacity-90 p-0.5 flex items-center justify-center transition-all"
                          style={{ borderRadius: r.radius }}
                        >
                          <div
                            className="w-full h-full border border-current opacity-40"
                            style={{
                              borderRadius:
                                r.id === "full"
                                  ? "12px"
                                  : r.id === "large"
                                    ? "6px"
                                    : r.id === "medium"
                                      ? "3px"
                                      : "1px",
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 4: TYPOGRAPHY --- */}
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Typography
                </h2>
                <p className="text-xs text-gray-500 dark:text-white/50">
                  Select font family and display text size
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
              <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-3 w-full">
                {fonts.map((font) => (
                  <button
                    key={font.id}
                    onClick={() =>
                      onUpdatePreferences({ fontFamily: font.id as any })
                    }
                    className={`
                      py-3 px-2 flex flex-col items-center justify-center rounded-2xl border transition-all duration-200
                      ${
                        preferences.fontFamily === font.id
                          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 shadow-sm"
                          : "bg-gray-100/70 dark:bg-white/5 border-transparent hover:bg-gray-200/60 dark:hover:bg-white/10"
                      }
                    `}
                  >
                    <span
                      className={`text-xl text-gray-900 dark:text-white mb-1 ${font.class}`}
                    >
                      Aa
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-white/60 ${font.class}`}
                    >
                      {font.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="w-full md:w-64 shrink-0 flex flex-col">
                <span className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase tracking-wider mb-2">
                  Size
                </span>
                <div className="relative h-10 bg-gray-100/80 dark:bg-white/5 rounded-xl p-1 flex items-center">
                  {["small", "medium", "large"].map((size) => (
                    <button
                      key={size}
                      onClick={() =>
                        onUpdatePreferences({ fontSize: size as any })
                      }
                      className={`
                        flex-1 h-full rounded-lg text-xs font-medium transition-all duration-200 z-10
                        ${preferences.fontSize === size ? "text-emerald-700 dark:text-emerald-300 font-semibold" : "text-gray-500 dark:text-white/60"}
                      `}
                    >
                      <span className="capitalize">{size}</span>
                    </button>
                  ))}
                  <motion.div
                    className="absolute top-1 bottom-1 bg-white dark:bg-white/10 rounded-lg shadow-sm"
                    initial={false}
                    animate={{
                      left:
                        preferences.fontSize === "small"
                          ? "4px"
                          : preferences.fontSize === "medium"
                            ? "33.33%"
                            : "66.66%",
                      width: "calc(33.33% - 5px)",
                      x:
                        preferences.fontSize === "medium"
                          ? 2
                          : preferences.fontSize === "large"
                            ? 1
                            : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 5: ACTIVE DEVICES & SESSIONS --- */}
          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                    Active Devices & Sessions
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-white/50 truncate">
                    Verify and manage browser logins linked to this account
                  </p>
                </div>
              </div>
              {user && sessions.length > 0 && (
                <span className="shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                  {sessions.length} Active
                </span>
              )}
            </div>

            {!user ? (
              <div className="flex flex-col items-center justify-center p-6 bg-gray-100/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-250 dark:border-white/10 text-center">
                <Monitor className="w-6 h-6 text-gray-400 mb-2" />
                <h3 className="text-xs font-semibold text-gray-700 dark:text-white/80 mb-1">
                  Sign In Required
                </h3>
                <p className="text-xs session-text-muted max-w-sm">
                  Please sign in to track and manage your active logged-in
                  devices and sessions.
                </p>
              </div>
            ) : isLoadingSessions && sessions.length === 0 ? (
              <div className="space-y-2.5">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 bg-gray-100/50 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/10 animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg" />
                      <div className="space-y-1.5">
                        <div className="w-24 h-3.5 bg-gray-200 dark:bg-white/10 rounded" />
                        <div className="w-32 h-3 bg-gray-200 dark:bg-white/10 rounded" />
                      </div>
                    </div>
                    <div className="w-16 h-7 bg-gray-200 dark:bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 bg-gray-100/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-250 dark:border-white/10 text-center">
                <ShieldCheck className="w-6 h-6 text-indigo-500 mb-2" />
                <h3 className="text-xs font-semibold text-gray-700 dark:text-white/80 mb-1">
                  No Active Sessions Logged
                </h3>
                <p className="text-xs session-text-muted max-w-sm">
                  Your active logins will appear here once authenticated on
                  this network.
                </p>
              </div>
            ) : (
              <div className={sessions.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3"}>
                {/* Security status banner - Containerless design */}
                {sessions.length > 1 && (
                  <div className="md:col-span-2 flex items-start gap-2 text-xs font-medium text-amber-600 dark:text-amber-400/90 px-0.5 py-1">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <p className="leading-relaxed">
                      Your account is currently active on multiple devices.
                      If you do not recognize any of these locations or IP
                      addresses, revoke their session immediately.
                    </p>
                  </div>
                )}

                {Array.from(new Map([...terminatedSessions, ...sessions].map(s => [s.id, s])).values())
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((s) => {
                  const isTerminatedLocal = s.is_terminated_local || (s.session_key && s.session_key.startsWith("TERMINATED_"));
                  const isLoggedOutLocal = s.session_key && s.session_key.startsWith("LOGGED_OUT_");
                  const isCurrent =
                    (s.is_current ||
                    s.session_key ===
                      localStorage.getItem("ceaznet_session_key")) && !isTerminatedLocal && !isLoggedOutLocal;
                  const lowerDevice = (s.device_name || "").toLowerCase();
                  const isMobile =
                    lowerDevice.includes("iphone") ||
                    lowerDevice.includes("android") ||
                    lowerDevice.includes("ipad") ||
                    lowerDevice.includes("phone");
                  const isLaptop =
                    lowerDevice.includes("mac") ||
                    lowerDevice.includes("win") ||
                    lowerDevice.includes("linux") ||
                    lowerDevice.includes("laptop");

                  return (
                    <div
                      key={s.id}
                      className={`
                        p-3.5 sm:p-4 rounded-xl border transition-all duration-300 flex flex-col group
                        ${
                          isCurrent
                            ? "bg-emerald-500/[0.015] dark:bg-emerald-500/[0.03] border-emerald-500/20 dark:border-emerald-500/20 shadow-sm"
                            : "bg-black/[0.005] dark:bg-white/[0.01] border-gray-200/60 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/10"
                        }
                      `}
                    >
                      {/* Core Header info */}
                      <div className="flex flex-col gap-3">
                        {/* Device Name Row */}
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2.5 rounded-xl shrink-0 border duration-300 ${
                              isCurrent
                                ? "session-accent-badge border-indigo-400/10"
                                : "bg-gray-100 dark:bg-white/[0.02] text-gray-500 dark:text-white/50 border-transparent"
                            }`}
                          >
                            {isMobile ? (
                              <Smartphone className="w-4 h-4 text-indigo-500" />
                            ) : isLaptop ? (
                              <Laptop className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <Monitor className="w-4 h-4 text-indigo-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0 max-w-full">
                              <span className="font-bold text-[13px] sm:text-sm text-gray-900 dark:text-white truncate leading-tight">
                                {s.device_name || "Generic Web Browser"}
                              </span>
                              {s.battery_percentage != null && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-400 rounded-md shrink-0">
                                  <BatteryMedium className="w-3 h-3 text-indigo-500" />
                                  {s.battery_percentage}%
                                </span>
                              )}
                            </div>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 rounded-md select-none shrink-0">
                                This Device
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Location, IP Address */}
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-gray-500 dark:text-white/50 font-medium pb-0.5">
                          <span className="flex items-center gap-1.5 pt-0.5">
                            <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{s.location || "Unknown Location"}</span>
                          </span>
                          <span className="text-gray-300 dark:text-white/10 select-none pt-0.5">•</span>
                          <span className="flex items-center gap-1.5 font-mono text-[11px] pt-0.5">
                            <Fingerprint className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{s.ip_address || "Unknown IP"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Timeline bento layout: First Login vs Last Login */}
                      <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-gray-100/50 dark:border-white/[0.02]">
                        {/* Timeline Row - Side-by-side on Mobile */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs font-medium text-gray-500 dark:text-white/50">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-gray-400 dark:text-white/40 text-[10px] sm:text-[11px] font-medium shrink-0">First Login:</span>
                            <div className="truncate min-w-0">
                              <RelativeTimestamp dateInput={s.created_at} />
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-gray-400 dark:text-white/40 text-[10px] sm:text-[11px] font-medium shrink-0">Last Login:</span>
                            <div className="truncate min-w-0">
                              <RelativeTimestamp dateInput={s.last_active_at || s.created_at} />
                            </div>
                          </div>
                        </div>
                        {/* Action Row */}
                        <div className="flex items-center gap-2 w-full">
                          {isTerminatedLocal || isLoggedOutLocal ? (
                            <>
                              <div className="flex-1 w-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/25 flex items-center justify-center select-none shrink-0 text-center">
                                <span>{isLoggedOutLocal ? "Logged Out" : "Terminated"}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteSession(s.id)}
                                className="flex-1 w-full session-danger-btn text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 border cursor-pointer shrink-0"
                                title="Remove this session from the list"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </>
                          ) : isCurrent ? (
                            <div className="w-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center gap-1.5 select-none shrink-0">
                              <Shield className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Secure Session</span>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setConfirmTerminateId(s.id)
                              }
                              disabled={isTerminatingId === s.id}
                              className="w-full session-danger-btn text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 border cursor-pointer shrink-0"
                              title="Log out and terminate access for this remote login"
                            >
                              {isTerminatingId === s.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <LogOut className="w-3.5 h-3.5" />
                              )}
                              <span>Terminate Access</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 6: SYSTEM INFORMATION --- */}
          <motion.div variants={itemVariants} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  System Information
                </h2>
                <p className="text-xs text-gray-500 dark:text-white/50">
                  Client v{packageInfo.version || '1.0.0'} • {import.meta.env.MODE === 'development' ? 'Development' : 'Production'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                  <Monitor className="w-3 h-3" /> Platform
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">
                  {systemInfo.os}
                </div>
              </div>
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Engine
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">
                  {systemInfo.browser}
                </div>
              </div>
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                  <Layout className="w-3 h-3" /> Display
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">
                  {systemInfo.screen}
                </div>
              </div>
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex flex-col justify-center">
                <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                  <RotateCw className="w-3 h-3" /> Network
                </div>
                <div className="text-xs font-semibold text-gray-800 dark:text-white/80 flex items-center gap-1.5 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full ${systemInfo.network === 'Online' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  {systemInfo.network}
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-3 max-w-md pt-1">
              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 hover:bg-gray-200/60 dark:hover:bg-white/10 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Key
                    className={`w-4 h-4 ${apiKey ? "text-emerald-500" : "text-gray-400"}`}
                  />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-white/80 whitespace-nowrap">
                    {apiKey ? `••••${apiKey.slice(-4)}` : "Setup API Key"}
                  </span>
                </div>
              </button>

              <button
                onClick={() => setIsResetConfirmOpen(true)}
                className="flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all text-red-600 dark:text-red-400 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                    Reset App
                  </span>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
          {/* Legal Footer for Public Verification */}
          <footer className="mt-8 text-center border-t border-neutral-200 dark:border-neutral-800 pt-6 pb-0 text-xs text-neutral-500 dark:text-neutral-500">
            <div className="flex items-center justify-center space-x-4 mb-2 font-mono">
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate("privacy-policy");
                }}
                className="hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
              >
                Privacy Policy
              </a>
              <span>•</span>
              <a
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate("about");
                }}
                className="hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
              >
                About
              </a>
              <span>•</span>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate("terms-of-service");
                }}
                className="hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
              >
                Terms of Service
              </a>
            </div>
            <p className="font-mono">
              &copy; {new Date().getFullYear()} {metadata.name}. Crafted with ❤️
            </p>
          </footer>
      </motion.main>

      {/* Modals - Moved outside motion.main to prevent fixed positioning issues */}
      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        onClose={() => {
            setIsResetting(false);
            setIsResetConfirmOpen(false);
        }}
        onConfirm={handleClearData}
        title="Reset Application Data?"
        message="This will clear your local preferences and view state. Your actual chat history stored in the cloud will be safe."
        confirmButtonText="Reset Data"
        confirmButtonVariant="danger"
        isLoading={isResetting}
      />

      <ConfirmationModal
        isOpen={!!confirmTerminateId}
        onClose={() => {
            setIsTerminating(false);
            setConfirmTerminateId(null);
        }}
        onConfirm={async () => {
          if (confirmTerminateId) {
            setIsTerminating(true);
            try {
              await handleTerminateSession(confirmTerminateId, false);
            } finally {
              setIsTerminating(false);
              setConfirmTerminateId(null);
            }
          }
        }}
        title="Terminate Session"
        message="Are you sure you want to log out and terminate access for this remote session?"
        confirmButtonText="Terminate"
        confirmButtonVariant="danger"
        isLoading={isTerminating}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSetApiKey={handleApiKeyUpdate}
        currentApiKey={apiKey}
      />
    </>
  );
};

export default SettingsView;
