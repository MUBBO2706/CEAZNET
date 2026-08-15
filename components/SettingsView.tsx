import React, { useState, useEffect } from "react";
import { UIPreferences, UserProfile, View } from "../types";
import {
  Type,
  Monitor,
  Trash2,
  Key,
  Cpu,
  Layout,
  Maximize,
  Minimize,
  Globe,
  RotateCw,
  Zap,
  Play,
} from "lucide-react";
import { motion } from "motion/react";
import ConfirmationModal from "./ConfirmationModal";
import ApiKeyModal from "./ApiKeyModal";
import { getSetting } from "../services/dbService";
import { useAuth } from "../hooks/useAuth";
import metadata from "../metadata.json";
import packageInfo from "../package.json";

interface SettingsViewProps {
  onBack?: () => void;
  onNavigate: (view: View) => void;
  preferences: UIPreferences;
  onUpdatePreferences: (newPrefs: Partial<UIPreferences>) => void;
  currentTheme?: "light" | "dark" | "system";
  onThemeChange?: (theme: "light" | "dark" | "system") => void;
  userProfile?: UserProfile;
  onEditProfile?: () => void;
  isChargingSupported?: boolean;
  onPreviewCharging?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onUpdatePreferences,
  onNavigate,
  isChargingSupported = true,
  onPreviewCharging,
}) => {
  const { user } = useAuth();
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const [systemInfo, setSystemInfo] = useState({
    os: "Unknown",
    deviceType: "Desktop",
    browser: "Unknown",
    browserVersion: "",
    engine: "WebKit",
    screen: "",
    dpr: "1.0x",
    orientation: "Portrait",
    network: "Online",
    connType: "Active",
    rtt: "",
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    let os = "Unknown OS";
    if (ua.indexOf("Win") !== -1) os = "Windows";
    if (ua.indexOf("Mac") !== -1) os = "MacOS";
    if (ua.indexOf("Linux") !== -1) os = "Linux";
    if (ua.indexOf("Android") !== -1) os = "Android";
    if (ua.indexOf("like Mac") !== -1) os = "iOS";

    let deviceType = "Desktop";
    if (/Mobi|Android|iPhone|iPad/i.test(ua)) {
      deviceType = /iPad|Tablet/i.test(ua) ? "Tablet" : "Mobile";
    }

    let browser = "Unknown Browser";
    let browserVersion = "";
    let engine = "Blink";

    const chromeMatch = ua.match(/Chrome\/([0-9.]+)/);
    const safariMatch = ua.match(/Version\/([0-9.]+).*Safari/);
    const firefoxMatch = ua.match(/Firefox\/([0-9.]+)/);
    const edgeMatch = ua.match(/Edg\/([0-9.]+)/);

    if (edgeMatch) {
      browser = "Edge";
      browserVersion = "v" + edgeMatch[1].split(".")[0];
      engine = "Blink";
    } else if (chromeMatch) {
      browser = "Chrome";
      browserVersion = "v" + chromeMatch[1].split(".")[0];
      engine = "Blink";
    } else if (firefoxMatch) {
      browser = "Firefox";
      browserVersion = "v" + firefoxMatch[1].split(".")[0];
      engine = "Gecko";
    } else if (safariMatch) {
      browser = "Safari";
      browserVersion = "v" + safariMatch[1].split(".")[0];
      engine = "WebKit";
    } else {
      if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) {
        browser = "Safari";
        engine = "WebKit";
      }
    }

    const dpr = `${window.devicePixelRatio.toFixed(1)}x`;
    const getOrientation = () => window.innerWidth > window.innerHeight ? "Landscape" : "Portrait";

    let connType = "Active";
    let rtt = "";
    const conn = (navigator as any).connection;
    if (conn) {
      if (conn.effectiveType) {
        connType = conn.effectiveType.toUpperCase();
      }
      if (conn.rtt !== undefined) {
        rtt = `${conn.rtt}ms`;
      }
    }

    setSystemInfo({
      os,
      deviceType,
      browser,
      browserVersion,
      engine,
      screen: `${window.innerWidth} × ${window.innerHeight}`,
      dpr,
      orientation: getOrientation(),
      network: navigator.onLine ? "Online" : "Offline",
      connType,
      rtt,
    });

    const handleResize = () =>
      setSystemInfo((prev) => ({
        ...prev,
        screen: `${window.innerWidth} × ${window.innerHeight}`,
        orientation: getOrientation(),
      }));
    const handleOnline = () =>
      setSystemInfo((prev) => ({ ...prev, network: "Online" }));
    const handleOffline = () =>
      setSystemInfo((prev) => ({ ...prev, network: "Offline" }));

    window.addEventListener("resize", handleResize);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
    { id: "quicksand", label: "Quicksand", class: "font-quicksand" },
    { id: "sans", label: "Geist Sans", class: "font-sans" },
    { id: "inter", label: "Inter", class: "font-inter" },
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
          {/* Header Title */}
          <motion.div variants={itemVariants} className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Application Settings
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-white/60">
              Customize typography, layout density, and system configurations
            </p>
          </motion.div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 1: INTERFACE --- */}
          <motion.div variants={itemVariants} className="space-y-5 w-full">
            <div className="flex items-center gap-3 shrink-0">
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

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 2: TYPOGRAPHY --- */}
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="flex items-center gap-3">
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

          {/* --- SECTION 3: POWER & FOCUS --- */}
          {isChargingSupported && (
            <>
              <hr className="border-t border-gray-200 dark:border-white/10" />
              <motion.div variants={itemVariants} className="space-y-6">
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      Power & Focus
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-white/50">
                      Manage charging behavior and focus modes
                    </p>
                  </div>
                </div>

                <div className="space-y-5 w-full">
                  {/* Charging Mode Option */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        Charging Mode Overlay
                      </span>
                      <p className="text-xs text-gray-500 dark:text-white/50">
                        Plays charging animation when plugged into a charger
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {onPreviewCharging && (preferences.chargingModeEnabled ?? true) && (
                        <button
                          onClick={onPreviewCharging}
                          title="Preview Charging Animation"
                          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 border border-amber-500/20"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Preview</span>
                        </button>
                      )}
                      <button
                        onClick={() => onUpdatePreferences({ chargingModeEnabled: !(preferences.chargingModeEnabled ?? true) })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                          (preferences.chargingModeEnabled ?? true) ? 'bg-amber-500' : 'bg-gray-200 dark:bg-white/10'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                            (preferences.chargingModeEnabled ?? true) ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {(preferences.chargingModeEnabled ?? true) && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                            Animation Duration
                          </span>
                          <p className="text-xs text-gray-500 dark:text-white/50">
                            How long to show the rich animation before saving power
                          </p>
                        </div>
                        <div className="p-1.5 bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 rounded-2xl flex items-center gap-1 self-start sm:self-auto">
                          {[1, 2, 5].map((mins) => (
                            <button
                              key={mins}
                              onClick={() => onUpdatePreferences({ chargingModeDuration: mins })}
                              className={`
                                px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 flex items-center gap-2
                                ${
                                  (preferences.chargingModeDuration ?? 1) === mins
                                    ? "bg-white dark:bg-white/10 text-amber-600 dark:text-amber-400 shadow-sm border border-black/5 dark:border-white/10"
                                    : "text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white"
                                }
                              `}
                            >
                              {mins} min
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                            Minimal Black Screen
                          </span>
                          <p className="text-xs text-gray-500 dark:text-white/50">
                            Switch to a minimal black screen after animation ends
                          </p>
                        </div>
                        <button
                          onClick={() => onUpdatePreferences({ chargingModeBlackScreen: !(preferences.chargingModeBlackScreen ?? true) })}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                            (preferences.chargingModeBlackScreen ?? true) ? 'bg-amber-500' : 'bg-gray-200 dark:bg-white/10'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              (preferences.chargingModeBlackScreen ?? true) ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 4: SYSTEM INFORMATION --- */}
          <motion.div variants={itemVariants} className="space-y-5">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  System Information
                </h2>
                <p className="text-xs text-gray-500 dark:text-white/50">
                  Real-time environment diagnostics and system telemetry status
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Platform Card */}
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex flex-col justify-center min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                    <Monitor className="w-3 h-3 text-blue-500 shrink-0" /> Platform
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">
                    {systemInfo.os}
                  </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <div className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30">
                    Device
                  </div>
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-white/50 truncate max-w-[70px]">
                    {systemInfo.deviceType}
                  </div>
                </div>
              </div>

              {/* Engine Card */}
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex flex-col justify-center min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-500 shrink-0" /> Engine
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">
                    {systemInfo.browser}
                  </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <div className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30">
                    {systemInfo.engine}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-white/50 truncate max-w-[70px]">
                    {systemInfo.browserVersion || "Latest"}
                  </div>
                </div>
              </div>

              {/* Display Card */}
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex flex-col justify-center min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                    <Layout className="w-3 h-3 text-purple-500 shrink-0" /> Display
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-white/80 truncate">
                    {systemInfo.screen}
                  </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <div className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30">
                    {systemInfo.orientation}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-white/50 truncate max-w-[70px]">
                    {systemInfo.dpr} DPR
                  </div>
                </div>
              </div>

              {/* Network Card */}
              <div className="p-3.5 bg-gray-100/70 dark:bg-white/5 rounded-2xl border border-gray-200/50 dark:border-white/5 flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex flex-col justify-center min-w-0">
                  <div className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 mb-1 flex items-center gap-1">
                    <RotateCw className="w-3 h-3 text-amber-500 shrink-0" /> Network
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-white/80 flex items-center gap-1.5 truncate">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${systemInfo.network === "Online" ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
                    ></span>
                    {systemInfo.network}
                  </div>
                </div>
                <div className="text-right shrink-0 pl-1">
                  <div className="text-[9px] uppercase font-bold text-gray-400 dark:text-white/30">
                    {systemInfo.connType}
                  </div>
                  <div className="text-[10px] font-semibold text-gray-600 dark:text-white/50 truncate max-w-[70px]">
                    {systemInfo.rtt || "Active"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-row justify-end gap-3 pt-1 w-full">
              <button
                onClick={() => setIsApiKeyModalOpen(true)}
                className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 hover:bg-gray-200/60 dark:hover:bg-white/10 transition-all shadow-sm"
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
                className="flex items-center justify-center py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all text-red-600 dark:text-red-400 shadow-sm"
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

        {/* Legal Footer */}
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

      {/* Modals */}
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
