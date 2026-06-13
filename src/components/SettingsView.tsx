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
  RefreshCw,
  LogOut,
  Clock,
  Lock,
  Shield,
  Calendar,
  Fingerprint,
  BatteryMedium,
} from "lucide-react";
import { motion } from "motion/react";
import ConfirmationModal from "./ConfirmationModal";
import ApiKeyModal from "./ApiKeyModal";
import { getSetting } from "../services/dbService";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../services/supabaseClient";
import metadata from "../../metadata.json";
import packageInfo from "../../package.json";

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
  const { user, session, logout } = useAuth();

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
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [terminatedSessions, setTerminatedSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isTerminatingId, setIsTerminatingId] = useState<string | null>(null);
  const [confirmTerminateId, setConfirmTerminateId] = useState<string | null>(
    null,
  );

  const isFetchingRef = useRef(false);
  const lastSessionKeyLoadedRef = useRef<string | null>(null);

  const loadSessions = async (forceRefetch = false) => {
    if (!user || !session) return;
    // Prevent concurrent twin fetches due to rapid React state adjustments,
    // and bypass if we already have the session active listing successfully loaded.
    if (isFetchingRef.current) return;
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
        setSessions(data || []);
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
      const response = await fetch("/api/sessions?action=terminate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
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
      () => {
        loadSessions(true);
      },
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (!user) return;
    getSetting<string>("kalina_api_key", user).then((storedKey) => {
      if (storedKey) setApiKey(storedKey);
    });
  }, [user?.id]);

  const handleClearData = () => {
    localStorage.removeItem("kalina_active_conversation_id");
    localStorage.removeItem("kalina_ui_preferences");
    window.location.reload();
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
        className="relative z-10 h-full overflow-y-auto bg-gray-50 dark:bg-black transition-colors duration-300 pt-20 md:pt-24 pb-6"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-2">
            {/* --- PROFILE CARD --- */}
            <motion.div
              variants={itemVariants}
              className="col-span-1 md:col-span-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

              <div className="relative z-10 flex items-center gap-4 w-full sm:w-auto">
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
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1">
                    {user
                      ? userProfile?.full_name || user?.email?.split("@")[0]
                      : "Guest User"}
                  </h2>
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
                <div className="flex items-center gap-3 w-full sm:w-auto relative z-10">
                  <button
                    onClick={onEditProfile}
                    className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => logout()}
                    className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-semibold bg-white dark:bg-white/5 text-red-600 dark:text-red-400 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95 whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </motion.div>

            {/* --- THEME CARD --- */}
            <motion.div
              variants={itemVariants}
              className="col-span-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Appearance
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                                                : "bg-gray-50 dark:bg-white/5 border-transparent hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-200 dark:hover:border-white/20"
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
            </motion.div>

            {/* --- LAYOUT CARD --- */}
            <motion.div
              variants={itemVariants}
              className="col-span-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Interface
                  </h2>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-white/60">
                    Density
                  </span>
                  <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                    {["comfortable", "compact"].map((layout) => (
                      <button
                        key={layout}
                        onClick={() =>
                          onUpdatePreferences({ layoutDensity: layout as any })
                        }
                        className={`
                                                    px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2
                                                    ${
                                                      preferences.layoutDensity ===
                                                      layout
                                                        ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm"
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

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-white/60">
                    Corners
                  </span>
                  <div className="flex gap-2">
                    {radii.map((r) => (
                      <button
                        key={r.id}
                        onClick={() =>
                          onUpdatePreferences({ borderRadius: r.id as any })
                        }
                        className={`
                                                    w-10 h-10 rounded-xl border transition-all flex items-center justify-center
                                                    ${
                                                      preferences.borderRadius ===
                                                      r.id
                                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                                        : "border-transparent bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10"
                                                    }
                                                `}
                        title={r.label}
                      >
                        <div
                          className="w-4 h-4 border-2 border-current opacity-80"
                          style={{ borderRadius: r.radius }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10">
                  <span className="text-sm font-medium text-gray-600 dark:text-white/60">
                    Show Time Bubble
                  </span>
                  <button
                    onClick={() =>
                      onUpdatePreferences({
                        showTimeBubble:
                          preferences.showTimeBubble === false ? true : false,
                      })
                    }
                    className={`
                                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                                            ${preferences.showTimeBubble !== false ? "bg-blue-600" : "bg-gray-200 dark:bg-white/10"}
                                        `}
                  >
                    <span
                      className={`
                                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                                ${preferences.showTimeBubble !== false ? "translate-x-6" : "translate-x-1"}
                                            `}
                    />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* --- TYPOGRAPHY CARD --- */}
            <motion.div
              variants={itemVariants}
              className="col-span-1 md:col-span-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    Typography
                  </h2>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {fonts.map((font) => (
                    <button
                      key={font.id}
                      onClick={() =>
                        onUpdatePreferences({ fontFamily: font.id as any })
                      }
                      className={`
                                                py-3 px-2 flex flex-col items-center justify-center rounded-2xl border transition-all duration-200
                                                ${
                                                  preferences.fontFamily ===
                                                  font.id
                                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 shadow-sm"
                                                    : "bg-gray-50 dark:bg-white/5 border-transparent hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-200 dark:hover:border-white/20"
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

                <div className="w-full md:w-64 shrink-0 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 dark:text-white/60 uppercase tracking-wider">
                      Size
                    </span>
                  </div>
                  <div className="relative h-10 bg-gray-100 dark:bg-white/5 rounded-xl p-1 flex items-center">
                    {["small", "medium", "large"].map((size) => (
                      <button
                        key={size}
                        onClick={() =>
                          onUpdatePreferences({ fontSize: size as any })
                        }
                        className={`
                                                    flex-1 h-full rounded-lg text-xs font-medium transition-all duration-200 z-10
                                                    ${preferences.fontSize === size ? "text-emerald-700 dark:text-emerald-300" : "text-gray-500 dark:text-white/60"}
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

            {/* --- ACTIVE DEVICES & SESSIONS CARD --- */}
            <motion.div
              variants={itemVariants}
              className="col-span-1 md:col-span-2 session-card border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start sm:items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 session-accent-badge border rounded-xl shrink-0">
                    <ShieldCheck className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      Active Devices & Sessions
                    </h2>
                    <p className="text-xs session-text-muted font-medium truncate">
                      Verify and manage browser logins linked to this account
                    </p>
                  </div>
                </div>
                {user && sessions.length > 0 && (
                  <span className="shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15 whitespace-nowrap mt-1 sm:mt-0">
                    {sessions.length} Active
                  </span>
                )}
              </div>

              {!user ? (
                <div className="flex flex-col items-center justify-center p-6 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-250 dark:border-white/10 text-center">
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
                      className="flex items-center justify-between p-3.5 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 animate-pulse"
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
                <div className="flex flex-col items-center justify-center p-6 bg-gray-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-250 dark:border-white/10 text-center">
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
                <div className="space-y-3">
                  {/* Security status banner for engaging alerts */}
                  {sessions.length > 1 && (
                    <div className="p-3 rounded-xl border session-danger-badge flex items-start gap-2.5 text-xs font-medium">
                      <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span>
                          Your account is currently active on multiple devices.
                          If you do not recognize any of these locations or IP
                          addresses, revoke their session immediately.
                        </span>
                      </div>
                    </div>
                  )}

                  {Array.from(new Map([...sessions, ...terminatedSessions].map(s => [s.id, s])).values())
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((s) => {
                    const isTerminatedLocal = s.is_terminated_local || (s.session_key && s.session_key.startsWith("TERMINATED_"));
                    const isCurrent =
                      (s.is_current ||
                      s.session_key ===
                        localStorage.getItem("kalina_session_key")) && !isTerminatedLocal;
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
                                                        : "bg-black/[0.005] dark:bg-white/[0.01] border-gray-100/60 dark:border-white/[0.04] hover:border-gray-200 dark:hover:border-white/10"
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

                          {/* Location, IP Address aligned to the Left Edge of the card - NO indent! Added nice padding (pt-1) to avoid badges sticking */}
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
                          {/* Timeline Row */}
                          <div className="flex flex-row items-center gap-x-2 text-[9px] sm:text-[10px] md:text-[11px] text-gray-500 dark:text-white/40 min-w-0">
                            <span className="flex items-center gap-0.5 shrink-0">
                              <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span>First: {formatSessionDate(s.created_at)}</span>
                            </span>
                            <span className="text-gray-300 dark:text-white/10 shrink-0 select-none">|</span>
                            <span className="flex items-center gap-0.5 shrink-0">
                              <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span>Last: {formatSessionDate(s.last_active_at || s.created_at)}</span>
                            </span>
                          </div>
                          {/* Action Row on next line - Full width edge-to-edge elements */}
                          <div className="flex items-center gap-2 w-full">
                            {isTerminatedLocal ? (
                              <>
                                <div className="flex-1 w-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/25 flex items-center justify-center select-none shrink-0 text-center">
                                  <span>Terminated</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteSession(s.id)}
                                  className="flex-1 w-full session-danger-btn text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 border cursor-pointer shrink-0"
                                  title="Remove this terminated session from the list"
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
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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

            {/* --- SYSTEM CARD --- */}
            <motion.div
              variants={itemVariants}
              className="col-span-1 border border-gray-200 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow bg-red-50/20 dark:bg-red-900/10 flex flex-col justify-between"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-100 dark:bg-white/10 rounded-xl text-gray-600 dark:text-white/80">
                  <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    System
                  </h2>
                </div>
              </div>

              <div className="flex flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="flex-1 flex items-center justify-center py-2.5 px-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
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
                  className="flex-1 flex items-center justify-center py-2.5 px-3 rounded-2xl bg-red-50/50 dark:bg-red-500/5 border border-transparent hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-100 dark:hover:border-red-500/20 transition-all text-red-600 dark:text-red-400"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
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
        </div>
      </motion.main>

      {/* Modals - Moved outside motion.main to prevent fixed positioning issues */}
      <ConfirmationModal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleClearData}
        title="Reset Application Data?"
        message="This will clear your local preferences and view state. Your actual chat history stored in the cloud will be safe."
        confirmButtonText="Reset Data"
        confirmButtonVariant="danger"
      />

      <ConfirmationModal
        isOpen={!!confirmTerminateId}
        onClose={() => setConfirmTerminateId(null)}
        onConfirm={() => {
          if (confirmTerminateId) {
            handleTerminateSession(confirmTerminateId, false);
            setConfirmTerminateId(null);
          }
        }}
        title="Terminate Session"
        message="Are you sure you want to log out and terminate access for this remote session?"
        confirmButtonText="Terminate"
        confirmButtonVariant="danger"
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
