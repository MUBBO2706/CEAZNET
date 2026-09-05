import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  MoleculeData,
  VoiceName,
  UserProfile,
  NewsArticle,
  UserArticleInteraction,
  UIPreferences,
  Conversation,
  VoicePersona,
} from "./types";
import { initializeAiClient } from "./services/aiClient";
import { useChargingMode } from "./hooks/useChargingMode";
import ChargingOverlay from "./components/ChargingOverlay";
import FloatingHeader from "./components/FloatingHeader";
import ApiKeyModal from "./components/ApiKeyModal";
import ViewRenderer from "./components/ViewRenderer";
import {
  getSetting,
  saveSetting,
  saveMultipleSettings,
  getTranslatorUsage,
  saveTranslatorUsage,
  getLocalUserProfile,
  incrementStat,
  saveInteraction,
  getInteractions,
  getBookmarkCount,
  saveConversation,
} from "./services/dbService";
import {
  uploadFileToTelegram,
  UploadMetadata,
} from "./services/telegramStorage";
import { useAuth } from "./hooks/useAuth";
import AuthModal from "./components/AuthModal";
import ProfileModal from "./components/ProfileModal";
import UpdatePasswordModal from "./components/UpdatePasswordModal";
import ConfirmationModal from "./components/ConfirmationModal";
import SessionTerminatedModal from "./components/SessionTerminatedModal";
import { supabase } from "./services/supabaseClient";
import { BroadcastPopup } from "./components/BroadcastPopup";
import { VersionUpdateModal } from "./components/VersionUpdateModal";
import { SystemBanner } from "./components/SystemBanner";
import { fetchNews } from "./services/newsService";
import { fetchUserSessions } from "./utils/sessionApi";
import { getImage, batchFetchAndCacheImages } from "./services/imageCachingService";
import Sidebar from "./components/Sidebar";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { useToast } from "./components/ToastSystem";
import { updateBrowserThemeColor } from "./utils/themeColor";
import { updatePageMetadata } from "./utils/seoMetadata";
import { parseTerminationSessionKey, SessionTerminationInfo } from "./utils/deviceUtils";

import { useLocation, useNavigate } from "react-router-dom";

const allExploreCategories = [
  "technology",
  "business",
  "science",
  "health",
  "sports",
  "entertainment",
];
const UI_PREFS_KEY = "ceaznet_ui_preferences";

// Automatically and transparently migrate all legacy local storage keys starting with 'kalina_' to 'ceaznet_'
try {
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('kalina_')) {
      keysToMigrate.push(key);
    }
  }
  keysToMigrate.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const newKey = key.replace('kalina_', 'ceaznet_');
      localStorage.setItem(newKey, value);
      localStorage.removeItem(key);
    }
  });
} catch (e) {
  console.error("Local storage migration error:", e);
}

const DEFAULT_UI_PREFS: UIPreferences = {
  fontSize: "medium",
  fontFamily: "quicksand",
  layoutDensity: "comfortable",
  borderRadius: "small",
};

// --- ROUTING HELPERS ---
const viewToPath: Record<View, string> = {
  home: "/",
  explore: "/explore",
  "article-reader": "/explore/reader",
  notes: "/notes",
  finance: "/finance",
  dairy: "/dairy",
  gallery: "/gallery",
  translator: "/translator",
  "molecule-viewer": "/molecule",
  "live-conversation": "/live",
  settings: "/settings",
  about: "/about",
  features: "/features",
  "privacy-policy": "/privacy-policy",
  "terms-of-service": "/terms-of-service",
  "voice-history": "/voice-history",
  "voice-settings": "/voice-settings",
  support: "/support",
  profile: "/profile",
  "shared-note": "/notes/share",
  "not-found": "/404",
};

const pathToView: Record<string, View> = Object.entries(viewToPath).reduce(
  (acc, [view, path]) => {
    acc[path] = view as View;
    return acc;
  },
  {} as Record<string, View>,
);

const App: React.FC = () => {
  const { user, session, authEvent, logout, isLoading: isAuthLoading } = useAuth();
  const networkStatus = useNetworkStatus();
  const { addToast } = useToast();
  const prevNetworkStatus = useRef(networkStatus);

  const location = useLocation();
  const navigate = useNavigate();

  const [isUpdatePasswordModalOpen, setIsUpdatePasswordModalOpen] =
    useState(false);
  const [isSessionTerminatedModalOpen, setIsSessionTerminatedModalOpen] =
    useState(false);
  const [terminationInfo, setTerminationInfo] = useState<SessionTerminationInfo>({});

  useEffect(() => {
    if (authEvent === "PASSWORD_RECOVERY") {
      setIsUpdatePasswordModalOpen(true);
    }
  }, [authEvent]);

  useEffect(() => {
    if (networkStatus.isOnline !== prevNetworkStatus.current.isOnline) {
      if (networkStatus.isOnline) {
        addToast("You're back online.", "success");
      } else {
        addToast(
          "You are currently offline. Some features may be unavailable.",
          "warning",
        );
      }
    }

    if (
      networkStatus.isSlow &&
      !prevNetworkStatus.current.isSlow &&
      networkStatus.isOnline
    ) {
      addToast("Your network connection is very slow.", "info");
    }

    prevNetworkStatus.current = networkStatus;
  }, [networkStatus, addToast]);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Derived view from location
  const currentPath = location.pathname;
  const currentView = useMemo(() => {
    if (currentPath === "/" || currentPath === "/home") return "home";
    if (currentPath.startsWith("/explore/reader")) return "article-reader";
    if (currentPath.startsWith("/explore")) return "explore";
    if (currentPath.startsWith("/notes/share/") || currentPath.startsWith("/share/") || currentPath.startsWith("/notes/s/")) return "shared-note";
    if (currentPath.startsWith("/notes")) return "notes";
    if (currentPath.startsWith("/finance")) return "finance";
    if (currentPath.startsWith("/dairy")) return "dairy";
    if (currentPath.startsWith("/gallery")) return "gallery";
    if (currentPath.startsWith("/translator")) return "translator";
    if (currentPath.startsWith("/molecule")) return "molecule-viewer";
    if (currentPath.startsWith("/live")) return "live-conversation";
    if (currentPath.startsWith("/settings")) return "settings";
    if (currentPath.startsWith("/about")) return "about";
    if (currentPath.startsWith("/features")) return "features";
    if (currentPath.startsWith("/privacy-policy")) return "privacy-policy";
    if (currentPath.startsWith("/terms-of-service")) return "terms-of-service";
    if (currentPath.startsWith("/voice-history")) return "voice-history";
    if (currentPath.startsWith("/voice-settings")) return "voice-settings";
    if (currentPath.startsWith("/support")) return "support";
    if (currentPath.startsWith("/profile")) return "profile";
    return "not-found" as View;
  }, [currentPath]);

  const prevPathRef = useRef(currentPath);

  useEffect(() => {
    updateBrowserThemeColor();
    updatePageMetadata(currentView, currentPath);
  }, [currentPath, currentView]);
  const [previousView, setPreviousView] = useState<View | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notesSearchQuery, setNotesSearchQuery] = useState("");
  const [financeSearchQuery, setFinanceSearchQuery] = useState("");
  const [voiceHistorySearchQuery, setVoiceHistorySearchQuery] = useState("");
  const [voiceHistoryVersion, setVoiceHistoryVersion] = useState(0);

  // Synchronously update previous view and clear search queries during render when path changes
  if (prevPathRef.current !== currentPath) {
    const oldPath = prevPathRef.current;
    prevPathRef.current = currentPath;

    let prevV: View = "home";
    if (oldPath.startsWith("/explore/reader")) prevV = "article-reader";
    else if (oldPath.startsWith("/explore")) prevV = "explore";
    else if (oldPath.startsWith("/notes")) prevV = "notes";
    else if (oldPath.startsWith("/finance")) prevV = "finance";
    else if (oldPath.startsWith("/dairy")) prevV = "dairy";
    else if (oldPath.startsWith("/gallery")) prevV = "gallery";
    else if (oldPath.startsWith("/translator")) prevV = "translator";
    else if (oldPath.startsWith("/molecule")) prevV = "molecule-viewer";
    else if (oldPath.startsWith("/live")) prevV = "live-conversation";
    else if (oldPath.startsWith("/settings")) prevV = "settings";
    else if (oldPath.startsWith("/profile")) prevV = "profile";

    setPreviousView(prevV);
    setNotesSearchQuery("");
    setFinanceSearchQuery("");
    setVoiceHistorySearchQuery("");
  }

  const [uiPreferences, setUiPreferences] = useState<UIPreferences>(() => {
    try {
      const stored = localStorage.getItem(UI_PREFS_KEY);
      return stored
        ? { ...DEFAULT_UI_PREFS, ...JSON.parse(stored) }
        : DEFAULT_UI_PREFS;
    } catch {
      return DEFAULT_UI_PREFS;
    }
  });
  const {
    isSupported: isChargingSupported,
    overlayState: chargingOverlayState,
    batteryLevel,
    isPreview: isChargingPreview,
    triggerPreview: triggerChargingPreview,
    closePreview: closeChargingPreview,
  } = useChargingMode(uiPreferences);

  const exploreActiveCategoryRef = useRef<string>("for-you");

  const handleNavigate = useCallback((view: View) => {
    let targetPath = viewToPath[view] || "/404";
    if (view === "explore") {
      const cat = exploreActiveCategoryRef.current;
      targetPath = cat === "for-you" ? "/explore/for-you" : `/explore/${cat}`;
    }
    navigate(targetPath);
    setIsSidebarOpen(false);
  }, [navigate]);

  const handleUpdatePreferences = useCallback((newPrefs: Partial<UIPreferences>) => {
    setUiPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem(UI_PREFS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleProfileUpdate = useCallback((updatedProfile: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updatedProfile }));
  }, []);

  // Apply UI Preferences Effect
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (uiPreferences.fontSize === "small") root.style.fontSize = "13px";
    else if (uiPreferences.fontSize === "large") root.style.fontSize = "16px";
    else root.style.fontSize = "14px";
    body.classList.remove(
      "font-sans",
      "font-serif",
      "font-mono",
      "font-inter",
      "font-playfair",
      "font-quicksand",
    );
    body.classList.add(`font-${uiPreferences.fontFamily}`);
    if (uiPreferences.layoutDensity === "compact")
      body.classList.add("layout-compact");
    else body.classList.remove("layout-compact");
    root.setAttribute("data-radius", uiPreferences.borderRadius || "medium");
  }, [uiPreferences]);

  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [translatorUsage, setTranslatorUsage] = useState<{
    input: number;
    output: number;
  }>({ input: 0, output: 0 });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    const root = document.documentElement;
    const lightHljs = document.getElementById("hljs-light-theme");
    const darkHljs = document.getElementById("hljs-dark-theme");
    if (newTheme === "system") {
      localStorage.removeItem("theme");
      const systemIsDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setIsDarkMode(systemIsDark);
      root.classList.toggle("dark", systemIsDark);
      lightHljs?.toggleAttribute("disabled", systemIsDark);
      darkHljs?.toggleAttribute("disabled", !systemIsDark);
    } else {
      localStorage.setItem("theme", newTheme);
      const isDark = newTheme === "dark";
      setIsDarkMode(isDark);
      root.classList.toggle("dark", isDark);
      lightHljs?.toggleAttribute("disabled", isDark);
      darkHljs?.toggleAttribute("disabled", !isDark);
    }
  };

  const [moleculeForFullScreen, setMoleculeForFullScreen] =
    useState<MoleculeData | null>(null);
  const [articleForReading, setArticleForReading] =
    useState<NewsArticle | null>(null);
  const [voiceModeVoice, setVoiceModeVoice] = useState<VoiceName>("Elara");
  const [voiceModePersonaInstruction, setVoiceModePersonaInstruction] =
    useState<string>("");
  const [voiceModeToneInstruction, setVoiceModeToneInstruction] =
    useState<string>("");
  const [voiceModeCustomInstruction, setVoiceModeCustomInstruction] =
    useState<string>("");
  const [voicePersonas, setVoicePersonas] = useState<VoicePersona[]>([]);
  const [activeVoicePersona, setActiveVoicePersona] = useState<string | null>(
    null,
  );
  const [isVoiceProactiveMode, setIsVoiceProactiveMode] = useState(true);
  const [isAudioRecordingEnabled, setIsAudioRecordingEnabled] = useState(true);
  const [voiceContinuationContext, setVoiceContinuationContext] =
    useState<string>("");
  const [exploreCurrentIndex, setExploreCurrentIndex] = useState(0);
  const [exploreActiveCategory, setExploreActiveCategory] =
    useState<string>("for-you");
  exploreActiveCategoryRef.current = exploreActiveCategory;
  const [exploreArticles, setExploreArticles] = useState<NewsArticle[]>([]);
  const [exploreIsLoading, setExploreIsLoading] = useState(true);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<
    Record<string, UserArticleInteraction>
  >({});
  const [isBookmarkFeedOpen, setIsBookmarkFeedOpen] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("ceaznet_anon_interactions");
      if (stored) {
        const allInteractions = JSON.parse(stored);
        return Object.values(allInteractions).filter((i: any) => i.bookmarked).length;
      }
    } catch {}
    return 0;
  });
  const [isVoiceConversationSaving, setIsVoiceConversationSaving] =
    useState(false);

  const urlExploreCategory = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    if (parts.length === 2 && parts[0] === "explore") {
      if (parts[1] === "for-you") return "for-you";
      if (allExploreCategories.includes(parts[1])) {
        return parts[1];
      }
    }
    return null;
  }, [currentPath]);

  if (urlExploreCategory && exploreActiveCategory !== urlExploreCategory) {
    setExploreActiveCategory(urlExploreCategory);
    setExploreCurrentIndex(0);
  }

  const urlReaderId = useMemo(() => {
    const parts = currentPath.split("/");
    if (parts.length >= 4 && parts[1] === "explore" && parts[2] === "reader" && parts[3]) {
      return parts[3];
    }
    return null;
  }, [currentPath]);

  const prevUrlReaderIdRef = useRef<string | null>(urlReaderId);
  if (prevUrlReaderIdRef.current !== urlReaderId) {
    prevUrlReaderIdRef.current = urlReaderId;
    if (!urlReaderId) {
      if (articleForReading !== null) {
        setArticleForReading(null);
      }
    } else {
      try {
        const decodedUrl = atob(urlReaderId.replace(/-/g, "+").replace(/_/g, "/"));
        const found = exploreArticles.find((a) => a.url === decodedUrl);
        if (found && articleForReading?.url !== decodedUrl) {
          setArticleForReading(found);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  useEffect(() => {
    if (!urlReaderId) return;
    try {
      const decodedUrl = atob(urlReaderId.replace(/-/g, "+").replace(/_/g, "/"));
      if (!articleForReading || articleForReading.url !== decodedUrl) {
        const found = exploreArticles.find((a) => a.url === decodedUrl);
        if (found) {
          setArticleForReading(found);
        } else {
          supabase
            .from("public_news_articles")
            .select("*")
            .eq("article_data->>url", decodedUrl)
            .maybeSingle()
            .then(({ data }) => {
              if (data && data.article_data) {
                const formattedRaw = data.formatted_content_md;
                const art: NewsArticle = {
                  ...(data.article_data as NewsArticle),
                  category: data.category,
                  formattedContent: typeof formattedRaw === 'string' ? { markdown: formattedRaw } : formattedRaw,
                  views: data.views,
                  likes: data.likes,
                  bookmarks: data.bookmarks,
                };
                setArticleForReading(art);
              }
            });
        }
      }
    } catch (e) {
      console.error("Invalid base64 URL ID");
    }
  }, [urlReaderId, exploreArticles, articleForReading]);

  // Initial load and dynamic state image bulk fetching and caching trigger (2 hours TTL)
  useEffect(() => {
    if (exploreArticles.length > 0) {
      const imageUrls = exploreArticles
        .map((a) => a.image)
        .filter((img): img is string => !!img && typeof img === "string" && img.startsWith("http"));

      if (imageUrls.length > 0) {
        (async () => {
          const uniqueUrls = Array.from(new Set(imageUrls));
          const uncachedUrls: string[] = [];

          // Query local cache first to minimize redundant network bandwidth
          for (const url of uniqueUrls) {
            const cached = await getImage(url);
            if (!cached) {
              uncachedUrls.push(url);
            }
          }

          if (uncachedUrls.length > 0) {
            console.log(`[Image Cache] Found ${uncachedUrls.length} uncached images. Warming up server-side cache...`);
            await batchFetchAndCacheImages(uncachedUrls);
          }
        })();
      }
    }
  }, [exploreArticles]);

  const [galleryHeaderState, setGalleryHeaderState] = useState<{
    onUpload?: () => void;
    isUploading?: boolean;
  }>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getNewsForCategory = async (category: string) => {
      setExploreIsLoading(true);
      setExploreError(null);
      setExploreArticles([]);
      setExploreCurrentIndex(0);
      try {
        const fetchedArticles = await fetchNews(category, true);
        setExploreArticles(fetchedArticles);
      } catch (err: any) {
        setExploreError(err.message || "An unknown error occurred.");
      } finally {
        setExploreIsLoading(false);
      }
    };
    const getNewsForAll = async () => {
      setExploreIsLoading(true);
      setExploreError(null);
      setExploreArticles([]);
      setExploreCurrentIndex(0);
      try {
        // Fetch all categories initially to show a diverse feed, but in 'lite' mode
        const promises = allExploreCategories.map((cat) =>
          fetchNews(cat, true),
        );
        const results = await Promise.allSettled(promises);
        const successfulResults = results
          .filter(
            (res): res is PromiseFulfilledResult<NewsArticle[]> =>
              res.status === "fulfilled",
          )
          .map((res) => res.value);
        const flattenedArticles = successfulResults.flat();
        const shuffled = flattenedArticles.sort(() => 0.5 - Math.random());
        setExploreArticles(shuffled);
      } catch (err: any) {
        setExploreError(
          err.message || "An unknown error occurred while fetching all news.",
        );
      } finally {
        setExploreIsLoading(false);
      }
    };
    if (exploreActiveCategory === "for-you") getNewsForAll();
    else getNewsForCategory(exploreActiveCategory);
  }, [exploreActiveCategory]);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: "",
    name: "User",
    full_name: "User",
    avatar_url: null,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      setIsProfileLoading(true);
      if (user) {
        try {
          const { data, error, status } = await supabase
            .from("profiles")
            .select(`full_name, avatar_url, is_suspended`)
            .eq("id", user.id)
            .maybeSingle();
          if (error && status !== 406) throw error;
          if (data)
            setUserProfile({
              id: user.id,
              name: data.full_name,
              full_name: data.full_name,
              avatar_url: data.avatar_url,
              is_suspended: data.is_suspended,
              username: user.user_metadata?.username || user.email?.split('@')[0] || "sandbox_mode",
            });
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
        } finally {
          setIsProfileLoading(false);
        }
      } else {
        setUserProfile({
          id: "",
          name: "User",
          full_name: "User",
          avatar_url: null,
        });
        getLocalUserProfile()
          .then((localProfile) => {
            if (localProfile) {
              setUserProfile({
                id: "",
                name: localProfile.name || "User",
                full_name: localProfile.full_name || "User",
                avatar_url: localProfile.avatar_url || null,
              });
            }
          })
          .catch((e) =>
            console.error("Failed to load local User Profile from DB", e),
          )
          .finally(() => setIsProfileLoading(false));
      }
    };
    fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthLoading && !user && currentView === "profile") {
      handleNavigate("home");
    }
  }, [isAuthLoading, user, currentView, handleNavigate]);

  // Reset full screen / active article state synchronously when leaving those views
  if (currentView !== "molecule-viewer" && moleculeForFullScreen !== null) {
    setMoleculeForFullScreen(null);
  }
  if (currentView !== "article-reader" && articleForReading !== null && !currentPath.startsWith("/explore/reader")) {
    setArticleForReading(null);
  }

  useEffect(() => {
    getTranslatorUsage(user)
      .then(setTranslatorUsage)
      .catch((e) => console.error("Failed to load translator usage", e));
  }, [user?.id]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          storedVoice,
          storedPersona,
          storedTone,
          storedCustom,
          storedProactive,
          storedRecording,
          storedPersonas,
          storedActivePersona,
        ] = await Promise.all([
          getSetting<VoiceName>("ceaznet_voice_mode_voice", user),
          getSetting<string>("ceaznet_voice_mode_persona_instruction", user),
          getSetting<string>("ceaznet_voice_mode_tone_instruction", user),
          getSetting<string>("ceaznet_voice_mode_custom_instruction", user),
          getSetting<boolean>("ceaznet_voice_proactive_mode", user),
          getSetting<boolean>("ceaznet_voice_recording_enabled", user),
          getSetting<VoicePersona[]>("ceaznet_voice_personas", user),
          getSetting<string>("ceaznet_voice_persona", user),
        ]);
        setVoiceModeVoice(storedVoice || "Elara");
        setVoiceModePersonaInstruction(storedPersona || "");
        setVoiceModeToneInstruction(storedTone || "");
        setVoiceModeCustomInstruction(storedCustom || "");
        setIsVoiceProactiveMode(
          storedProactive !== undefined ? storedProactive : true,
        );
        setIsAudioRecordingEnabled(
          storedRecording !== undefined ? storedRecording : true,
        );
        if (storedPersonas) setVoicePersonas(storedPersonas);
        if (storedActivePersona) setActiveVoicePersona(storedActivePersona);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    };
    loadSettings();
  }, [user?.id]);

  useEffect(() => {
    getSetting<string>("ceaznet_api_key", user).then((storedApiKey) => {
      if (storedApiKey) {
        try {
          initializeAiClient(storedApiKey);
          setApiKey(storedApiKey);
        } catch (e) {
          console.error("Failed to initialize API key", e);
        }
      }
    });

    const handleRequestApiKey = () => setIsApiKeyModalOpen(true);
    const handleUpdateApiKey = (e: Event) => {
      const key = (e as CustomEvent).detail;
      handleSetApiKey(key);
    };

    window.addEventListener("request-api-key", handleRequestApiKey);
    window.addEventListener("update-api-key", handleUpdateApiKey);

    return () => {
      window.removeEventListener("request-api-key", handleRequestApiKey);
      window.removeEventListener("update-api-key", handleUpdateApiKey);
    };
  }, [user?.id]);

  // Active Device & Session Tracking effect
  useEffect(() => {
    if (!user || !session) return;

    let lastSupabaseUpdate = Date.now();

    const getCoordinates = (): Promise<{
      latitude: number;
      longitude: number;
    } | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            console.warn("[Session Tracking] Geolocation error:", error);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 600000 },
        );
      });
    };

    const getDetailedDeviceName = async (): Promise<string> => {
      const { getExactDeviceName } = await import('./utils/deviceUtils');
      return await getExactDeviceName();
    };

    const getDeviceBattery = async (): Promise<number | null> => {
      const { getBatteryPercentage } = await import('./utils/deviceUtils');
      return await getBatteryPercentage();
    };

    const trackSession = async () => {
      try {
        let sessionKey = localStorage.getItem("ceaznet_session_key");
        if (!sessionKey) {
          sessionKey =
            window.crypto && window.crypto.randomUUID
              ? window.crypto.randomUUID()
              : Math.random().toString(36).substring(2) +
                Date.now().toString(36);
          localStorage.setItem("ceaznet_session_key", sessionKey);
        }

        const { getPersistentDeviceId } = await import('./utils/deviceUtils');
        let deviceId = await getPersistentDeviceId();


        let coords = null;
        try {
          coords = await getCoordinates();
        } catch (coordsErr) {
          console.warn(
            "[Session Geolocation] Handled coordinates fetch error:",
            coordsErr,
          );
        }

        const batteryPercentage = await getDeviceBattery();

        let is_incognito = false;
        let browser_name = "Unknown";
        let browser_version = "";
        let os_name = "Unknown";
        let os_version = "";

        try {
          const { detectIncognito } = await import('detectincognitojs');
          const result = await detectIncognito();
          is_incognito = result.isPrivate;
        } catch (e) {
          console.warn("Failed to check incognito:", e);
        }

        try {
          const { UAParser } = await import('ua-parser-js');
          const parser = new UAParser();
          const pResult = parser.getResult();
          browser_name = pResult.browser.name || "Unknown";
          browser_version = pResult.browser.version || "";
          os_name = pResult.os.name || "Unknown";
          os_version = pResult.os.version || "";
        } catch (e) {
          console.warn("Failed to parse UA:", e);
        }

        const response = await fetch("/api/sessions?action=track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            session_key: sessionKey,
            device_id: deviceId,
            client_device_name: await getDetailedDeviceName(),
            latitude: coords?.latitude,
            longitude: coords?.longitude,
            battery_percentage: batteryPercentage,
            is_incognito,
            browser_name,
            browser_version,
            os_name,
            os_version
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          console.warn(
            "[Session Tracking] Failed to track session:",
            errData.error,
          );
          if (errData.isTerminated) {
            if (errData.session_key) {
               const parsed = parseTerminationSessionKey(errData.session_key);
               if (errData.terminated_at && !parsed.time) {
                 parsed.time = errData.terminated_at;
               }
               setTerminationInfo(parsed);
            }
            addToast("Your session was terminated remotely.", "warning");
            setIsSessionTerminatedModalOpen(true);
            logout();
          }
        } else {
          const data = await response.json();
          console.log("[Session Tracking] Session tracked successfully:", data);
        }
      } catch (err) {
        console.error("[Session Tracking] Error in session tracker:", err);
      }
    };

    trackSession();

    let lastHeartbeatTime = 0;
    const HEARTBEAT_THROTTLE_MS = 15000; // 15 seconds

    const sendHeartbeat = async (statusOverride?: string) => {
        try {
          const now = Date.now();
          if (statusOverride && now - lastHeartbeatTime < HEARTBEAT_THROTTLE_MS) {
             // Skip sending immediate heartbeat if triggered within the throttle window
             // (except maybe tab_closed, but sendBeacon handles that anyway)
             if (statusOverride !== 'tab_closed') return;
          }
          lastHeartbeatTime = now;

          const sessionKey = localStorage.getItem("ceaznet_session_key");
          if (!sessionKey) return;
          const { getPersistentDeviceId, getExactDeviceName, getBatteryPercentage } = await import('./utils/deviceUtils');
          const deviceId = await getPersistentDeviceId();
          const deviceName = await getExactDeviceName();
          const batteryPercentage = await getBatteryPercentage();
          
          const skipDbUpdate = !statusOverride && (Date.now() - lastSupabaseUpdate < 5 * 60 * 1000);
          if (!skipDbUpdate && !statusOverride) {
            lastSupabaseUpdate = Date.now();
          }
          
          if (statusOverride) {
            // Use sendBeacon for reliable delivery on unload/hide
            const blob = new Blob([JSON.stringify({
              session_key: sessionKey,
              device_id: deviceId,
              client_device_name: deviceName,
              battery_percentage: batteryPercentage,
              status_override: statusOverride
            })], { type: 'application/json' });
            navigator.sendBeacon("/api/sessions?action=heartbeat", blob);
          } else {
            fetch("/api/sessions?action=heartbeat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({
                session_key: sessionKey,
                device_id: deviceId,
                client_device_name: deviceName,
                battery_percentage: batteryPercentage,
                skip_db_update: skipDbUpdate
              }),
            }).catch(() => {});
          }
        } catch (e) {}
    };

    let heartbeatInterval: any = null;

    const startHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => sendHeartbeat(), 60000); // 1 minute
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    // Initial start
    startHeartbeat();

    const handlePageHide = () => {
      sendHeartbeat('tab_closed');
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      stopHeartbeat();
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [user?.id]);

  // Track Remote Terminations of Active Session via standard polling AND instant Supabase Realtime !
  useEffect(() => {
    if (!user || !session) return;

    const checkSessionTermination = async () => {
      try {
        const sessionKey = localStorage.getItem("ceaznet_session_key");
        if (!sessionKey) return;

        const tokenKey = `session_check_${user.id}`;
        if (sessionStorage.getItem(tokenKey)) {
          return;
        }
        // Immediately set tokenKey to prevent race conditions during concurrent effect mounts
        sessionStorage.setItem(tokenKey, "checked");

        const data = await fetchUserSessions(session.access_token);

        if (data && Array.isArray(data.data) && data.data.length > 0 && !data.data[0].id.includes("fallback")) {
          const terminatedSession = data.data.find(
            (s: any) => s.session_key && s.session_key.startsWith(`TERMINATED_${sessionKey}`)
          );
          
          // If they are explicitly terminated, log out.
          if (terminatedSession) {
            const parsed = parseTerminationSessionKey(terminatedSession.session_key);
            if (terminatedSession.last_active_at && !parsed.time) {
               parsed.time = terminatedSession.last_active_at;
            }
            setTerminationInfo(parsed);
            addToast(
              "Your session has been terminated from another device.",
              "warning",
            );
            setIsSessionTerminatedModalOpen(true);
            logout();
          }
        }
      } catch (err) {
        // Ignore transient network errors
      }
    };

    // Initial check on load/mount
    checkSessionTermination();

    // 1. Setup Supabase Realtime Listener for instant push notification logout !
    const sessionKey = localStorage.getItem("ceaznet_session_key");
    const channel = supabase
      .channel(`active-sessions-sync-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to any change (deletes or updates) in user's sessions table
          schema: "public",
          table: "user_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log("[Realtime Session Change] Event received:", payload);

          if (
            payload.eventType === "UPDATE" &&
            payload.new &&
            payload.new.session_key &&
            payload.new.session_key.startsWith(`TERMINATED_${sessionKey}`)
          ) {
            const parsed = parseTerminationSessionKey(payload.new.session_key);
            if (payload.new.last_active_at && !parsed.time) {
               parsed.time = payload.new.last_active_at;
            }
            setTerminationInfo(parsed);
            addToast("Your session was terminated remotely.", "warning");
            setIsSessionTerminatedModalOpen(true);
            logout();
            return;
          }

          if (
            payload.eventType === "DELETE" &&
            payload.old &&
            payload.old.session_key === sessionKey
          ) {
            setTerminationInfo({
              deviceName: "Another Device",
              time: new Date().toISOString(),
            });
            addToast("Your session was deleted remotely.", "warning");
            setIsSessionTerminatedModalOpen(true);
            logout();
            return;
          }
        },
      )
      .subscribe((status) => {
        console.log(
          `[Sessions Realtime Subscription] Channel Status: ${status}`,
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, logout, addToast]);

  useEffect(() => {
    const fetchInteractions = async () => {
      if (exploreArticles.length > 0) {
        const urls = exploreArticles.map((a) => a.url);
        const interactionsList = await getInteractions(user, urls);
        const interactionsMap = interactionsList.reduce(
          (acc, curr) => {
            acc[curr.article_url] = curr;
            return acc;
          },
          {} as Record<string, UserArticleInteraction>,
        );
        setInteractions((prev) => {
          const merged = { ...prev, ...interactionsMap };
          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
          return merged;
        });
      }
    };
    fetchInteractions();
  }, [exploreArticles, user?.id]);

  useEffect(() => {
    const fetchBookmarkCount = async () => {
      const count = await getBookmarkCount(user);
      setBookmarkCount(count);
    };
    fetchBookmarkCount();
  }, [user?.id]); // Re-fetch when user authentication state resolves/changes

  const handleArticleUpdate = useCallback(
    (updatedArticle: NewsArticle) => {
      setExploreArticles((prev) =>
        prev.map((art) =>
          art.url === updatedArticle.url ? updatedArticle : art,
        ),
      );
      if (articleForReading && articleForReading.url === updatedArticle.url) {
        setArticleForReading(updatedArticle);
      }
    },
    [articleForReading],
  );

  const handleSetApiKey = (key: string) => {
    initializeAiClient(key);
    saveSetting("ceaznet_api_key", key, user);
    setApiKey(key);
    setIsApiKeyModalOpen(false);
  };

  const handleInteraction = useCallback(
    (articleUrl: string, type: "like" | "bookmark", forcedState?: boolean) => {
      if (userProfile?.is_suspended) {
        addToast("Interaction blocked: Account suspended.", "error");
        return;
      }
      const key = type === "like" ? "liked" : "bookmarked";
      const isCurrentlyActive = interactions[articleUrl]?.[key] ?? (forcedState === false ? true : false);
      const newState = forcedState !== undefined ? forcedState : !isCurrentlyActive;

      if (forcedState !== undefined && isCurrentlyActive === forcedState && interactions[articleUrl]?.[key] !== undefined) {
        return;
      }

      if (type === "bookmark") {
        setBookmarkCount((prev) =>
          Math.max(0, (prev ?? 0) + (newState ? 1 : -1)),
        );
      }

      // Update interaction state
      setInteractions((prev) => ({
        ...prev,
        [articleUrl]: {
          ...(prev[articleUrl] || {
            article_url: articleUrl,
            liked: false,
            bookmarked: false,
          }),
          [key]: newState,
        },
      }));

      // Update list of articles in Explore view
      setExploreArticles((prev) =>
        prev.map((art) =>
          art.url === articleUrl
            ? {
                ...art,
                [type === "like" ? "likes" : "bookmarks"]:
                  Math.max(0, (art[type === "like" ? "likes" : "bookmarks"] || 0) + (newState ? 1 : -1)),
              }
            : art,
        ),
      );

      // Update current reading article if it matches
      if (articleForReading && articleForReading.url === articleUrl) {
        setArticleForReading((prev) =>
          prev
            ? {
                ...prev,
                [type === "like" ? "likes" : "bookmarks"]:
                  Math.max(0, (prev[type === "like" ? "likes" : "bookmarks"] || 0) + (newState ? 1 : -1)),
              }
            : null,
        );
      }

      saveInteraction(user, {
        ...(interactions[articleUrl] || {
          article_url: articleUrl,
          liked: false,
          bookmarked: false,
        }),
        [key]: newState,
      });
      incrementStat(
        articleUrl,
        type === "like" ? "likes" : "bookmarks",
        newState,
      );
    },
    [interactions, user, articleForReading, userProfile?.is_suspended, addToast],
  );

  const handleSaveVoiceConversation = useCallback(
    async (transcript: any[], audioBlob?: Blob) => {
      if (userProfile?.is_suspended) {
        addToast("Save conversation blocked: Account suspended.", "error");
        return;
      }
      if (!transcript || transcript.length === 0) return;

      setIsVoiceConversationSaving(true);
      try {
        // Generate a title based on the first user message or default
        const firstUserMsg = transcript.find((t) => t.role === "user");
        const title = firstUserMsg
          ? firstUserMsg.text.slice(0, 30) +
            (firstUserMsg.text.length > 30 ? "..." : "")
          : "Voice Conversation";

        const conversationId = crypto.randomUUID();
        
        // Strip large audioChunks from messages before saving to DB
        const messagesToSave = transcript.map(m => {
          const { audioChunks, ...rest } = m;
          return rest;
        });

        const newConvo: Conversation = {
          id: conversationId,
          user_id: user?.id,
          title: title,
          messages: messagesToSave,
          createdAt: new Date().toISOString(),
          isVoiceConversation: true,
          audio_url: null,
        };

        // Save initial state
        await saveConversation(newConvo, user);

        // Upload audio in the background so we don't block the UI
        if (audioBlob) {
          const metadata: UploadMetadata = {
            userId: user?.id || "N/A",
            userName:
              userProfile?.full_name ||
              userProfile?.name ||
              user?.user_metadata?.full_name ||
              user?.user_metadata?.name ||
              "Voice Chat User",
            userEmail: user?.email || "N/A",
            uploadedAt: new Date().toISOString(),
            fileType: "VOICE CHAT RECORDING",
            mimeType: audioBlob.type || "audio/webm",
            fileSize: `${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB (${audioBlob.size.toLocaleString()} bytes)`,
          };
          uploadFileToTelegram(audioBlob, "voice_recording.webm", metadata)
            .then(async (audioUrl) => {
              if (audioUrl) {
                const updatedConvo = { ...newConvo, audio_url: audioUrl };
                // Update DB
                await saveConversation(updatedConvo, user);
              }
            })
            .catch((err) => {
              console.error(
                "Unexpected error uploading audio to Telegram:",
                err,
              );
            });
        }
      } finally {
        setIsVoiceConversationSaving(false);
        setVoiceHistoryVersion(v => v + 1);
      }
    },
    [user],
  );

  const handleTranslationComplete = useCallback(
    (t: { input: number; output: number }) => {
      setTranslatorUsage((prev) => {
        const newUsage = {
          input: prev.input + t.input,
          output: prev.output + t.output,
        };
        saveTranslatorUsage(newUsage, user).catch((e) =>
          console.error("Failed to save translator usage", e),
        );
        return newUsage;
      });
    },
    [user],
  );

  const [dairyHeaderState, setDairyHeaderState] = useState<{
    title: string | null;
    onBack?: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    onImport?: () => void;
    onExport?: () => void;
  }>({ title: null });

  const [notesHeaderState, setNotesHeaderState] = useState<{
    title: string | null;
    isReadOnly: boolean;
    isWalletLinked: boolean;
    isSyncing: boolean;
    onBack?: () => void;
    onEdit?: () => void;
    onSave?: () => void;
    onSync?: () => void;
  }>({
    title: null,
    isReadOnly: false,
    isWalletLinked: false,
    isSyncing: false,
  });

  const [supportHeaderState, setSupportHeaderState] = useState<{
    title: string | null;
    onBack?: () => void;
  }>({ title: null });

  const [isSavingVoiceSettings, setIsSavingVoiceSettings] = useState(false);

  const handleVoiceSettingChange = async (key: string, value: any) => {
    try {
      await saveSetting(key, value, user);
    } catch (e) {
      console.error("Failed to save setting", e);
    }
  };

  const handleVoiceSettingsChangeMulti = async (
    settings: Record<string, any>,
  ) => {
    try {
      await saveMultipleSettings(settings, user);
    } catch (e) {
      console.error("Failed to save multiple settings", e);
    }
  };

  const handleSaveVoiceSettings = async () => {
    setIsSavingVoiceSettings(true);
    try {
      await saveMultipleSettings(
        {
          ceaznet_voice_mode_voice: voiceModeVoice,
          ceaznet_voice_mode_persona_instruction: voiceModePersonaInstruction,
          ceaznet_voice_mode_tone_instruction: voiceModeToneInstruction,
          ceaznet_voice_mode_custom_instruction: voiceModeCustomInstruction,
          ceaznet_voice_proactive_mode: isVoiceProactiveMode,
          ceaznet_voice_recording_enabled: isAudioRecordingEnabled,
          ceaznet_voice_persona: activeVoicePersona,
        },
        user,
      );
      addToast("Voice settings saved successfully.", "success");
    } catch (e) {
      addToast("Failed to save voice settings.", "error");
    } finally {
      setIsSavingVoiceSettings(false);
    }
  };

  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const handleOpenSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const handleOpenAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const handleOpenProfileModal = useCallback(() => setIsProfileModalOpen(true), []);
  const handleOpenBookmarks = useCallback(() => setIsBookmarkFeedOpen(true), []);
  const handleCloseTranslator = useCallback(() => handleNavigate("home"), [handleNavigate]);
  const handleBackFromLive = useCallback(() => handleNavigate("home"), [handleNavigate]);
  const handleReadArticle = useCallback(
    (a: NewsArticle) => {
      setArticleForReading(a);
      const id = btoa(a.url)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      navigate("/explore/reader/" + id);
    },
    [navigate],
  );

  return (
    <>
      {isSidebarOpen && (
        <div
          onClick={handleCloseSidebar}
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
        />
      )}
      <div className="flex flex-col h-full bg-[#F9F6F2] dark:bg-black text-neutral-800 dark:text-white transition-colors duration-300">
        <div className="flex-none w-full">
          {!["notes", "shared-note"].includes(currentView) && (
            <SystemBanner isSuspended={userProfile?.is_suspended} />
          )}
        </div>
        <div className="flex flex-1 overflow-hidden relative">
          {currentView !== "shared-note" && (
            <Sidebar
              isMobileOpen={isSidebarOpen}
              onMobileClose={handleCloseSidebar}
              currentView={currentView}
              onNavigate={handleNavigate}
            />
          )}

          <div id="main-content-area" className="flex-1 flex flex-col overflow-hidden relative">
            {!["live-conversation", "not-found", "shared-note"].includes(currentView) && (
              <FloatingHeader
                onOpenSidebar={handleOpenSidebar}
                user={user}
                userProfile={userProfile}
                onOpenAuthModal={handleOpenAuthModal}
                onOpenProfileModal={handleOpenProfileModal}
                onLogout={logout}
                onNavigate={handleNavigate}
                currentView={currentView}
                previousView={previousView}
                bookmarkCount={bookmarkCount}
                onSaveVoiceSettings={handleSaveVoiceSettings}
                isSavingVoiceSettings={isSavingVoiceSettings}
                onOpenBookmarks={handleOpenBookmarks}
                isProfileLoading={isProfileLoading}
                notesSearchQuery={notesSearchQuery}
                setNotesSearchQuery={setNotesSearchQuery}
                financeSearchQuery={financeSearchQuery}
                setFinanceSearchQuery={setFinanceSearchQuery}
                voiceHistorySearchQuery={voiceHistorySearchQuery}
                setVoiceHistorySearchQuery={setVoiceHistorySearchQuery}
                articleTitle={articleForReading?.title}
                articleLikes={articleForReading?.likes}
                articleViews={articleForReading?.views}
                dairyTitle={dairyHeaderState.title}
                onDairyBack={dairyHeaderState.onBack}
                onDairyDelete={dairyHeaderState.onDelete}
                onDairyEdit={dairyHeaderState.onEdit}
                onDairyImport={dairyHeaderState.onImport}
                onDairyExport={dairyHeaderState.onExport}
                notesHeaderState={notesHeaderState}
                onGalleryUpload={galleryHeaderState.onUpload}
                isGalleryUploading={galleryHeaderState.isUploading}
                uiPreferences={uiPreferences}
                supportHeaderState={supportHeaderState}
              />
            )}

            <div
              ref={scrollContainerRef}
              className={`flex-1 min-h-0 scrollbar-hide ${currentView === "not-found" ? "flex flex-col overflow-hidden" : ["live-conversation", "reading", "explore", "article-reader", "settings", "profile", "finance", "notes", "shared-note", "about", "features", "privacy-policy", "terms-of-service", "molecule-viewer", "gallery"].includes(currentView) ? "overflow-hidden" : "overflow-y-auto"}`}
            >
              <ViewRenderer
                currentView={currentView}
                setCurrentView={handleNavigate}
                translatorUsage={translatorUsage}
                scrollContainerRef={scrollContainerRef}
                onCloseTranslator={handleCloseTranslator}
                onTranslationComplete={handleTranslationComplete}
                moleculeForFullScreen={moleculeForFullScreen}
                onMaximizeMoleculeViewer={setMoleculeForFullScreen}
                voiceModeVoice={voiceModeVoice}
                setVoiceModeVoice={setVoiceModeVoice}
                voiceModePersonaInstruction={voiceModePersonaInstruction}
                setVoiceModePersonaInstruction={setVoiceModePersonaInstruction}
                voiceModeToneInstruction={voiceModeToneInstruction}
                setVoiceModeToneInstruction={setVoiceModeToneInstruction}
                voiceModeCustomInstruction={voiceModeCustomInstruction}
                setVoiceModeCustomInstruction={setVoiceModeCustomInstruction}
                isVoiceProactiveMode={isVoiceProactiveMode}
                setIsVoiceProactiveMode={setIsVoiceProactiveMode}
                onBackFromLive={handleBackFromLive}
                onSaveVoiceConversation={handleSaveVoiceConversation}
                voiceContinuationContext={voiceContinuationContext}
                user={user}
                userProfile={userProfile}
                onReadArticle={handleReadArticle}
                articleForReading={articleForReading}
                exploreCurrentIndex={exploreCurrentIndex}
                setExploreCurrentIndex={setExploreCurrentIndex}
                exploreActiveCategory={exploreActiveCategory}
                setExploreActiveCategory={setExploreActiveCategory}
                exploreArticles={exploreArticles}
                setExploreArticles={setExploreArticles}
                exploreIsLoading={exploreIsLoading}
                exploreError={exploreError}
                interactions={interactions}
                handleInteraction={handleInteraction}
                isBookmarkFeedOpen={isBookmarkFeedOpen}
                setIsBookmarkFeedOpen={setIsBookmarkFeedOpen}
                bookmarkCount={bookmarkCount}
                uiPreferences={uiPreferences}
                onUpdatePreferences={handleUpdatePreferences}
                currentTheme={isDarkMode ? "dark" : "light"}
                onThemeChange={handleThemeChange}
                notesSearchQuery={notesSearchQuery}
                setNotesSearchQuery={setNotesSearchQuery}
                financeSearchQuery={financeSearchQuery}
                voiceHistorySearchQuery={voiceHistorySearchQuery}
                isVoiceConversationSaving={isVoiceConversationSaving}
                isAudioRecordingEnabled={isAudioRecordingEnabled}
                setIsAudioRecordingEnabled={setIsAudioRecordingEnabled}
                onArticleUpdate={handleArticleUpdate}
                onEditProfile={handleOpenProfileModal}
                onProfileUpdate={handleProfileUpdate}
                previousView={previousView}
                onOpenSidebar={handleOpenSidebar}
                onLogout={logout}
                onOpenAuthModal={handleOpenAuthModal}
                setDairyHeaderState={setDairyHeaderState}
                setNotesHeaderState={setNotesHeaderState}
                setGalleryHeaderState={setGalleryHeaderState}
                setSupportHeaderState={setSupportHeaderState}
                isSuspended={userProfile?.is_suspended}
                voicePersonas={voicePersonas}
                activeVoicePersona={activeVoicePersona}
                setActiveVoicePersona={setActiveVoicePersona}
                onVoiceSettingChange={handleVoiceSettingChange}
                onVoiceSettingsChangeMulti={handleVoiceSettingsChangeMulti}
                voiceHistoryVersion={voiceHistoryVersion}
                isChargingSupported={isChargingSupported}
                onPreviewCharging={triggerChargingPreview}
              />
            </div>
          </div>
        </div>
      </div>

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onSetApiKey={handleSetApiKey}
        onClose={() => setIsApiKeyModalOpen(false)}
        currentApiKey={apiKey}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      {user && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          userProfile={userProfile}
          onProfileUpdate={(p) => setUserProfile((prev) => ({ ...prev, ...p }))}
          onLogout={logout}
        />
      )}
      <UpdatePasswordModal
        isOpen={isUpdatePasswordModalOpen}
        onClose={() => setIsUpdatePasswordModalOpen(false)}
      />
      <SessionTerminatedModal
        isOpen={isSessionTerminatedModalOpen}
        terminatorDeviceName={terminationInfo.deviceName}
        terminatorLocation={terminationInfo.location}
        terminatorTime={terminationInfo.time}
      />
      <BroadcastPopup />
      <VersionUpdateModal />
      <ChargingOverlay
        state={chargingOverlayState}
        batteryLevel={batteryLevel}
        isPreview={isChargingPreview}
        onClose={closeChargingPreview}
      />
    </>
  );
};

export default App;
