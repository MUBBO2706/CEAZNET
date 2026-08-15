import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  Camera, 
  Save, 
  LogOut, 
  RotateCw, 
  Sun, 
  Moon, 
  Monitor, 
  Palette, 
  Layout, 
  Type, 
  Eye, 
  ArrowLeft, 
  Smartphone, 
  Laptop, 
  Globe, 
  MapPin, 
  Clock, 
  Sparkles, 
  Check, 
  X, 
  AlertCircle, 
  Loader2,
  Info,
  Shield,
  ChevronRight,
  Maximize,
  Minimize,
  Pencil,
  Lock,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { UIPreferences, UserProfile, View } from '../types';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';
import { useToast } from './ToastSystem';
import { SessionDetailsView, SessionItem, parseDeviceAndOS } from './Profile/SessionDetailsView';
import ConfirmationModal from './ConfirmationModal';
import metadata from '../metadata.json';
import { fetchUserSessions, invalidateUserSessionsCache } from '../utils/sessionApi';
import { getExactDeviceName } from '../utils/deviceUtils';

interface ProfileViewProps {
  onBack: () => void;
  onNavigate: (view: View) => void;
  preferences: UIPreferences;
  onUpdatePreferences: (newPrefs: Partial<UIPreferences>) => void;
  currentTheme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  userProfile: UserProfile;
  onProfileUpdate: (updatedProfile: Partial<UserProfile>) => void;
  setSupportHeaderState?: (state: { title: string | null; onBack?: () => void }) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onBack,
  onNavigate,
  preferences,
  onUpdatePreferences,
  currentTheme,
  onThemeChange,
  userProfile,
  onProfileUpdate,
  setSupportHeaderState,
}) => {
  const { user, session, logout, isLoggingOut } = useAuth();
  const { addToast } = useToast();

  // Mode: 'overview' (Identity, Appearance, Recent 1 Session) or 'sessions_codex' (Full detailed session history)
  const [viewMode, setViewMode] = useState<'overview' | 'sessions_codex'>(() => {
    return (localStorage.getItem('ceaznet_profile_view_mode') as 'overview' | 'sessions_codex') || 'overview';
  });

  useEffect(() => {
    localStorage.setItem('ceaznet_profile_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'sessions_codex') {
      setSupportHeaderState?.({
        title: 'Session Details',
        onBack: () => setViewMode('overview')
      });
    } else {
      setSupportHeaderState?.({
        title: null,
        onBack: undefined
      });
    }
    return () => {
      setSupportHeaderState?.({
        title: null,
        onBack: undefined
      });
    };
  }, [viewMode, setSupportHeaderState]);

  // User Identity Form State
  const [fullName, setFullName] = useState(userProfile.full_name || '');
  const [username, setUsername] = useState(userProfile.username || '');
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(userProfile.avatar_url || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOutLocal, setIsSigningOutLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sessions State
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [currentSessionKey, setCurrentSessionKey] = useState<string>('');
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [confirmingTerminateId, setConfirmingTerminateId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isRowActionRunning, setIsRowActionRunning] = useState<string | null>(null);

  const overviewTableScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to actions when confirming
  useEffect(() => {
    if ((confirmingTerminateId || confirmingDeleteId) && overviewTableScrollRef.current) {
      setTimeout(() => {
        if (overviewTableScrollRef.current) {
          overviewTableScrollRef.current.scrollTo({
            left: overviewTableScrollRef.current.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [confirmingTerminateId, confirmingDeleteId]);

  // Selected session for IP/Location detail modal in overview
  const [detailModalSession, setDetailModalSession] = useState<SessionItem | null>(null);

  // Sign out confirmation modal
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);

  useEffect(() => {
    setFullName(userProfile.full_name || '');
    setAvatarPreview(userProfile.avatar_url || null);
    setUsername(userProfile.username || '');
  }, [userProfile.full_name, userProfile.avatar_url, userProfile.username]);

  // Load session identifier from localStorage or memory
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('ceaznet_session_key') || localStorage.getItem('current_session_key') || '';
      const storedDevId = localStorage.getItem('ceaznet_device_id') || localStorage.getItem('device_fingerprint_id') || '';
      setCurrentSessionKey(storedKey);
      setCurrentDeviceId(storedDevId);
    } catch (e) {
      console.warn('Could not read session key from localStorage:', e);
    }
  }, []);

  // Fetch all user sessions from backend
  const fetchSessions = async (forceRefresh = false) => {
    if (!user) return;
    setIsLoadingSessions(true);
    try {
      const token = session?.access_token;
      if (!token) {
        setIsLoadingSessions(false);
        return;
      }

      const data = await fetchUserSessions(token, forceRefresh);
      if (data && Array.isArray(data.data)) {
        setSessions(data.data);
        
        // Asynchronously resolve device names
        try {
          const rawSessions = data.data;
          const { resolveDeviceName } = await import('../utils/deviceUtils');
          const resolvedList = await Promise.all(
            rawSessions.map(async (s: any) => {
              if (s.device_name) {
                try {
                  const resolvedName = await resolveDeviceName(s.device_name);
                  return { ...s, device_name: resolvedName };
                } catch (e) {
                  return s;
                }
              }
              return s;
            })
          );
          setSessions(resolvedList);
        } catch (resolveErr) {
          console.warn('Failed to resolve device names in session list:', resolveErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch user sessions:', err);
      addToast('Could not refresh session history.', 'error');
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
      
      const channel = supabase.channel(`profile_sessions_${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_sessions', filter: `user_id=eq.${user.id}` },
          (payload) => {
            invalidateUserSessionsCache();
            fetchSessions(true);
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, session?.access_token]);

  // Handle Avatar file selection
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  // Save profile updates
  const handleSaveProfile = async () => {
    if (userProfile.is_suspended) {
      addToast('Your account is suspended. Profile updates are disabled.', 'error');
      return;
    }

    if (!user) {
      addToast('You must be signed in to update your profile.', 'error');
      return;
    }

    setIsSavingProfile(true);
    let avatarUrl = userProfile.avatar_url;

    try {
      // 1. Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl;
      }

      // 2. Update profiles table
      const updates = {
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 2b. Save username in user metadata
      if (user && username) {
        const { error: metaError } = await supabase.auth.updateUser({
          data: { username: username.trim() }
        });
        if (metaError) throw metaError;
      }

      // 3. Update parent state & show toast
      onProfileUpdate({ 
        full_name: fullName.trim(), 
        avatar_url: avatarUrl,
        username: username.trim()
      });
      setIsEditing(false);
      addToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      console.error('Profile update failed:', err);
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    setIsSignOutConfirmOpen(false);
    setIsSigningOutLocal(true);
    try {
      await logout();
      addToast('Signed out successfully.', 'info');
      onNavigate('home');
    } catch (err: any) {
      console.error('Sign out error:', err);
      addToast('Failed to sign out cleanly.', 'error');
    } finally {
      setIsSigningOutLocal(false);
    }
  };

  // Terminate Single Session
  const handleTerminateSession = async (sessionId: string) => {
    if (!user || !session?.access_token) return;
    try {
      const deviceName = await getExactDeviceName();
      const currentSessionItem = sessions.find(s => s.is_current || s.session_key === currentSessionKey);
      const currentLocation = currentSessionItem?.location || undefined;
      const res = await fetch('/api/sessions?action=terminate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: sessionId,
          terminator_device_name: deviceName,
          terminator_location: currentLocation,
          terminator_time: new Date().toISOString(),
        }),
      });

      if (!res.ok) throw new Error('Failed to terminate session');

      addToast('Session terminated successfully.', 'success');
      invalidateUserSessionsCache();
      await fetchSessions(true);
    } catch (err: any) {
      console.error('Error terminating session:', err);
      addToast('Could not terminate session.', 'error');
    }
  };

  // Delete Single Session Record
  const handleDeleteSession = async (sessionId: string) => {
    if (!user || !session?.access_token) return;
    try {
      const res = await fetch('/api/sessions?action=delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: sessionId }),
      });

      if (!res.ok) throw new Error('Failed to delete session record');

      addToast('Session history deleted.', 'success');
      invalidateUserSessionsCache();
      await fetchSessions(true);
    } catch (err: any) {
      console.error('Error deleting session:', err);
      addToast('Could not delete session record.', 'error');
    }
  };

  // Bulk Terminate All Other Sessions
  const handleTerminateAllOther = async () => {
    if (!user || !session?.access_token) return;
    try {
      const otherSessions = sessions.filter(s => {
        const isCurrent = s.is_current || s.session_key === currentSessionKey;
        const key = s.session_key || '';
        return !isCurrent && !key.startsWith('TERMINATED_') && !key.startsWith('LOGGED_OUT_');
      });

      let successCount = 0;
      const deviceName = await getExactDeviceName();
      const currentSessionItem = sessions.find(s => s.is_current || s.session_key === currentSessionKey);
      const currentLocation = currentSessionItem?.location || undefined;
      for (const s of otherSessions) {
        const res = await fetch('/api/sessions?action=terminate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: s.id,
            terminator_device_name: deviceName,
            terminator_location: currentLocation,
            terminator_time: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          successCount++;
        }
      }
      addToast(`Terminated ${successCount} other active sessions.`, 'success');
      invalidateUserSessionsCache();
      await fetchSessions(true);
    } catch (err: any) {
      console.error('Error terminating other sessions:', err);
      addToast('Failed to terminate other sessions.', 'error');
    }
  };

  // Bulk Delete All Inactive Sessions
  const handleDeleteAllInactive = async () => {
    if (!user || !session?.access_token) return;
    try {
      const inactiveSessions = sessions.filter(s => {
        const key = s.session_key || '';
        return key.startsWith('TERMINATED_') || key.startsWith('LOGGED_OUT_');
      });
      for (const s of inactiveSessions) {
        await fetch('/api/sessions?action=delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: s.id }),
        });
      }
      addToast(`Deleted ${inactiveSessions.length} inactive records.`, 'success');
      invalidateUserSessionsCache();
      await fetchSessions(true);
    } catch (err: any) {
      console.error('Error clearing inactive sessions:', err);
      addToast('Failed to delete inactive sessions.', 'error');
    }
  };

  // Helper to format date & time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '-', time: '-', full: '-' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '-', time: '-', full: '-' };

    const date = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    return { date, time, full: `${date} at ${time}` };
  };

  // Format date & time on a single line
  const formatSingleLineDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    try {
      const options: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      };
      return new Intl.DateTimeFormat('en-GB', options).format(d).replace(',', '');
    } catch (e) {
      return d.toLocaleString('en-IN');
    }
  };

  // Calculate session status
  const getSessionStatus = (session: SessionItem): { status: 'active' | 'logged_out' | 'terminated' | 'expired'; label: string } => {
    const key = session.session_key || '';
    if (key.startsWith('LOGGED_OUT_')) {
      return { status: 'logged_out', label: 'Logged Out' };
    }
    if (key.startsWith('TERMINATED_')) {
      return { status: 'terminated', label: 'Terminated' };
    }

    const now = Date.now();
    const lastActive = new Date(session.last_active_at || session.created_at).getTime();
    if (now - lastActive > 35 * 60 * 1000 && !session.is_current && session.session_key !== currentSessionKey) {
      return { status: 'expired', label: 'Expired' };
    }

    return { status: 'active', label: 'Active' };
  };

  // Duration calculation
  const getDuration = (startStr: string, endStr?: string, isOngoing: boolean = false) => {
    const start = new Date(startStr).getTime();
    const end = isOngoing ? Date.now() : new Date(endStr || startStr).getTime();
    const diffMs = Math.max(0, end - start);

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  // Device Icon
  const getDeviceIcon = (deviceName?: string) => {
    const name = (deviceName || '').toLowerCase();
    if (name.includes('iphone') || name.includes('android') || name.includes('mobile') || name.includes('samsung') || name.includes('pixel')) {
      return <Smartphone className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
    }
    if (name.includes('mac') || name.includes('windows') || name.includes('linux') || name.includes('laptop') || name.includes('desktop')) {
      return <Laptop className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    }
    return <Globe className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
  };

  // Most recent 1 session preview
  const recentSession = useMemo(() => {
    if (sessions.length === 0) return null;
    return sessions[0];
  }, [sessions]);

  // Derived Avatar URL
  const defaultAvatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userProfile.full_name || user?.email || 'A')}`;
  const displayAvatarUrl = avatarPreview || userProfile.avatar_url || defaultAvatarUrl;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  // Render Full Session Registry Codex if viewMode === 'sessions_codex'
  if (viewMode === 'sessions_codex') {
    return (
      <SessionDetailsView
        sessions={sessions}
        currentSessionKey={currentSessionKey}
        currentDeviceId={currentDeviceId}
        userEmail={user?.email}
        userName={userProfile.full_name || ''}
        onBack={() => setViewMode('overview')}
        onRefresh={() => fetchSessions(true)}
        onTerminateSession={handleTerminateSession}
        onDeleteSession={handleDeleteSession}
        onTerminateAllOther={handleTerminateAllOther}
        onDeleteAllInactive={handleDeleteAllInactive}
        isLoading={isLoadingSessions}
      />
    );
  }

  return (
    <>
      <motion.main
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative z-10 h-full overflow-y-auto bg-gray-50 dark:bg-black transition-colors duration-300 pt-16 sm:pt-18 md:pt-20 pb-8 dev-console-spacing-pb"
      >
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-2 sm:py-4 space-y-6 sm:space-y-8">
          
          {/* Top Header Description only, styled like About/Terms (No icon, No H1 heading) */}
          <motion.div variants={itemVariants} className="mb-2 border-b border-neutral-200 dark:border-neutral-800 pb-4 mt-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">
                PERSONAL SETTINGS & PREFERENCES
              </span>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 font-sans max-w-2xl leading-relaxed">
              Configure visual presets, sound preferences, backup metrics, or hard reset database records.
            </p>
          </motion.div>

          {/* --- SECTION 1: USER IDENTITY --- */}
          <motion.div variants={itemVariants} className="space-y-4 w-full">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-2">
              <h2 className="text-xs font-bold text-gray-900 dark:text-white font-mono uppercase tracking-widest leading-none">
                Identity & Profile Photo
              </h2>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => {
                    setFullName(userProfile.full_name || '');
                    setIsEditing(true);
                  }}
                  className="text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none cursor-pointer flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider p-0 bg-transparent border-0"
                  title="Edit Profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFullName(userProfile.full_name || '');
                    }}
                    className="text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors focus:outline-none cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider"
                    title="Cancel"
                  >
                    <X className="w-4 h-4 shrink-0" />
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !fullName.trim()}
                    className="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center gap-1 text-[10px] font-mono uppercase tracking-wider font-bold"
                    title="Save Changes"
                  >
                    {isSavingProfile ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin flex-shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0" />
                    )}
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 w-full space-y-4">
              {/* Centered Avatar Image */}
              <div className="flex flex-col items-center justify-center py-2 w-full">
                <div 
                  className={`relative group rounded-full p-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-md ${
                    isEditing ? 'cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-red-500' : ''
                  }`}
                  onClick={() => isEditing && fileInputRef.current?.click()}
                >
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={displayAvatarUrl}
                      alt={userProfile.full_name || 'User Avatar'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {isEditing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/65 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Camera className="w-5 h-5 text-white mb-1" />
                      <span className="text-[9px] text-white font-mono font-bold uppercase tracking-wider">Change</span>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileSelect}
                    className="hidden"
                    disabled={!isEditing}
                  />
                </div>
              </div>

              {/* Data Fields */}
              <div className="grid grid-cols-2 gap-6 pt-2 max-w-xl mx-auto w-full">
                {/* Full Name Column */}
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block mb-1">
                    Full Name
                  </span>
                  {!isEditing ? (
                    <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                      {userProfile.full_name || 'N/A'}
                    </span>
                  ) : (
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Full Name"
                      className="bg-neutral-100 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none w-full font-sans"
                    />
                  )}
                </div>

                {/* Email ID Column (Locked) */}
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block mb-1">
                    Email ID
                  </span>
                  {!isEditing ? (
                    <span className="text-sm sm:text-base font-mono text-gray-500 dark:text-neutral-400 truncate">
                      {user?.email || 'N/A'}
                    </span>
                  ) : (
                    <div className="relative flex items-center w-full">
                      <Lock className="absolute right-2.5 w-3.5 h-3.5 text-neutral-500" />
                      <input
                        type="text"
                        disabled
                        value={user?.email || 'N/A'}
                        className="bg-neutral-100/50 dark:bg-neutral-950/50 border border-gray-200 dark:border-neutral-800 rounded-lg pr-8 pl-2.5 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 focus:outline-none w-full font-mono cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Private Storage Subtext */}
              <p className="text-left text-[10px] text-neutral-500 font-sans pt-2">
                Your profile photo and data are synchronized directly with Private Cloud Storage.
              </p>
            </div>
          </motion.div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 2: APPEARANCE & THEME --- */}
          <motion.div variants={itemVariants} className="space-y-4 w-full">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-2">
              <h2 className="text-xs font-bold text-gray-900 dark:text-white font-mono uppercase tracking-widest leading-none flex items-center gap-2">
                Theme & Appearance
              </h2>
            </div>

            <div className="pt-2 w-full space-y-4">
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block">
                Interface Mode
              </span>

              <div className="grid grid-cols-3 gap-2.5 w-full max-w-xl mx-auto">
                {[
                  { id: 'light', icon: Sun, label: 'Light Theme', color: 'text-amber-500 hover:text-amber-600' },
                  { id: 'system', icon: Monitor, label: 'System Theme', color: 'text-blue-500 hover:text-blue-600' },
                  { id: 'dark', icon: Moon, label: 'Dark Theme', color: 'text-indigo-500 hover:text-indigo-600' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onThemeChange(t.id as any)}
                    className={`
                      py-2.5 px-3 rounded-xl border flex flex-row items-center justify-center gap-2.5 text-xs font-semibold transition-all cursor-pointer focus:outline-none w-full
                      ${
                        currentTheme === t.id
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }
                    `}
                  >
                    <t.icon
                      className={`w-4 h-4 shrink-0 ${
                        currentTheme === t.id
                          ? 'text-purple-600 dark:text-purple-400'
                          : t.color
                      }`}
                    />
                    <span className="text-xs truncate font-sans tracking-tight">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Clean Horizontal Divider */}
          <hr className="border-t border-gray-200 dark:border-white/10" />

          {/* --- SECTION 3: ACTIVE SESSIONS & SECURITY --- */}
          <motion.div variants={itemVariants} className="space-y-4 w-full">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 pb-2">
              <h2 className="text-xs font-bold text-gray-900 dark:text-white font-mono uppercase tracking-widest leading-none flex items-center gap-2">
                Active Sessions & Security
              </h2>
              {sessions.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewMode('sessions_codex')}
                    className="flex items-center gap-1 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-xs font-semibold transition-all cursor-pointer bg-transparent border-0 p-0 focus:outline-none"
                    title="View Complete Session History"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View All</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {/* Overview Metadata */}
              <div className="grid grid-cols-2 gap-4 pb-1 text-xs text-left">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block mb-0.5">
                    Name
                  </span>
                  <span className="font-mono text-gray-700 dark:text-neutral-300 font-semibold truncate block">
                    {userProfile.full_name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 block mb-0.5">
                    Registered Since
                  </span>
                  <span className="font-sans text-gray-700 dark:text-neutral-300 font-semibold truncate block">
                    {user?.created_at ? formatDateTime(user.created_at).full : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Recent Session Logs List */}
              <div className="space-y-2.5 border-t border-gray-200 dark:border-white/10 pt-4 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400 dark:text-neutral-500 font-bold block text-[10px] uppercase font-mono tracking-wider">
                    Recent Session Logs
                  </span>
                  <span className="text-neutral-500 font-mono text-[9px]">
                    Showing {Math.min(10, sessions.length)} of {sessions.length}
                  </span>
                </div>

                {isLoadingSessions && sessions.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-gray-500 dark:text-white/50">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                    <span>Fetching active sessions...</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-500 dark:text-white/50 p-6 rounded-2xl bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5">
                    <p className="font-semibold text-gray-800 dark:text-white/80">No active session nodes recorded yet</p>
                    <p className="text-[11px] mt-1">Sessions are automatically logged upon authentication</p>
                  </div>
                ) : (
                  <div ref={overviewTableScrollRef} className="overflow-x-auto no-scrollbar -mx-4 sm:-mx-6 md:-mx-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] border-t border-b border-gray-200 dark:border-white/10 bg-white/40 dark:bg-neutral-950/20 text-left">
                    <table className="w-full text-left font-mono text-[10px] leading-normal border-collapse min-w-[650px]">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-neutral-950/20 text-gray-500 dark:text-neutral-400 uppercase tracking-wider border-b border-gray-200 dark:border-white/10 text-[8px]">
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Session Start</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Session End</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Duration</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Device</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Browser</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Mode</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">OS</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">IP Address</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Location</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Battery</th>
                          <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/40 dark:divide-white/5 text-gray-700 dark:text-neutral-300">
                        {sessions.slice(0, 10).map((s) => {
                          const statusInfo = getSessionStatus(s);
                          const isCurrent = s.is_current || s.session_key === currentSessionKey;
                          const durationStr = getDuration(s.created_at, s.last_active_at, statusInfo.status === 'active');
                          const deviceInfo = parseDeviceAndOS(s.device_name);

                          return (
                             <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {formatSingleLineDateTime(s.created_at)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                {statusInfo.status === 'active' ? (
                                  <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                                    Ongoing
                                  </span>
                                ) : (
                                  <span className="text-gray-500 dark:text-neutral-400 font-medium">
                                    {formatSingleLineDateTime(s.last_active_at)}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono text-gray-500 dark:text-neutral-400">
                                {durationStr}
                              </td>
                              <td className="py-2.5 px-3 text-left">
                                <span className="font-semibold truncate text-[10px] block max-w-[150px]" title={s.device_name}>
                                  {deviceInfo.device}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                <span className="text-gray-800 dark:text-neutral-300 font-medium truncate max-w-[100px] block" title={s.browser_name || 'Chrome'}>
                                  {s.browser_name || 'Chrome'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                {s.is_incognito ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                                    Private
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 uppercase tracking-wide">
                                    Normal
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-left">
                                <span className="text-gray-500 dark:text-neutral-400 font-medium">
                                  {deviceInfo.os}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                <button
                                  onClick={() => setDetailModalSession(s)}
                                  className="font-mono text-[10px] text-gray-800 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-purple-400 font-bold hover:underline cursor-pointer max-w-[110px] truncate block bg-transparent border-0 p-0 text-left"
                                  title={s.ip_address || '127.0.0.1'}
                                >
                                  {s.ip_address || '-'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                <button
                                  onClick={() => setDetailModalSession(s)}
                                  className="text-[10px] text-gray-800 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-purple-400 font-medium hover:underline cursor-pointer max-w-[130px] sm:max-w-[150px] truncate block bg-transparent border-0 p-0 text-left animate-none"
                                  title={s.location || 'Unknown Location'}
                                >
                                  <span className="truncate">{s.location || 'Unknown Location'}</span>
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap font-mono text-[10px]">
                                <span className="font-semibold text-gray-800 dark:text-neutral-300">
                                  {s.battery_percentage !== undefined && s.battery_percentage !== null ? `${s.battery_percentage}%` : 'N/A'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-left whitespace-nowrap">
                                {statusInfo.status === 'active' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                                    Active
                                  </span>
                                )}
                                {statusInfo.status === 'logged_out' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                                    Logged Out
                                  </span>
                                )}
                                {statusInfo.status === 'terminated' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 uppercase tracking-wide">
                                    Terminated
                                  </span>
                                )}
                                {statusInfo.status === 'expired' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 uppercase tracking-wide">
                                    Expired
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                {isCurrent ? (
                                  <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider shrink-0 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                    Current
                                  </span>
                                ) : isRowActionRunning === s.id ? (
                                  <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-gray-400">
                                    <span className="w-2.5 h-2.5 border border-gray-400/40 border-t-purple-500 rounded-full animate-spin inline-block"></span>
                                    <span>{confirmingDeleteId === s.id ? 'Deleting...' : 'Terminating...'}</span>
                                  </div>
                                ) : confirmingTerminateId === s.id ? (
                                  <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono">
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingTerminateId(null)}
                                      className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer uppercase font-semibold tracking-wider bg-transparent border-0 p-0"
                                    >
                                      Cancel
                                    </button>
                                    <span className="text-gray-400 dark:text-neutral-600">|</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        setIsRowActionRunning(s.id);
                                        try {
                                          await handleTerminateSession(s.id);
                                        } finally {
                                          setIsRowActionRunning(null);
                                          setConfirmingTerminateId(null);
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline cursor-pointer uppercase tracking-wider bg-transparent border-0 p-0"
                                    >
                                      Terminate
                                    </button>
                                  </div>
                                ) : confirmingDeleteId === s.id ? (
                                  <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono">
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingDeleteId(null)}
                                      className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer uppercase font-semibold tracking-wider bg-transparent border-0 p-0"
                                    >
                                      Cancel
                                    </button>
                                    <span className="text-gray-400 dark:text-neutral-600">|</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        setIsRowActionRunning(s.id);
                                        try {
                                          await handleDeleteSession(s.id);
                                        } finally {
                                          setIsRowActionRunning(null);
                                          setConfirmingDeleteId(null);
                                        }
                                      }}
                                      className="text-amber-500 dark:text-amber-400 hover:text-amber-600 font-bold hover:underline cursor-pointer uppercase tracking-wider bg-transparent border-0 p-0"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : statusInfo.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmingTerminateId(s.id);
                                      setConfirmingDeleteId(null);
                                    }}
                                    className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline cursor-pointer text-[9px] uppercase tracking-wider bg-transparent border-0 p-0"
                                    title="Remotely terminate this active session"
                                  >
                                    Terminate
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmingDeleteId(s.id);
                                      setConfirmingTerminateId(null);
                                    }}
                                    className="text-amber-500 dark:text-amber-400 hover:text-amber-600 font-bold hover:underline cursor-pointer text-[9px] uppercase tracking-wider bg-transparent border-0 p-0"
                                    title="Delete session record"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Legal Footer */}
        <footer className="mt-3 text-center border-t border-neutral-200 dark:border-neutral-800 pt-3.5 pb-2 text-xs text-neutral-500 dark:text-neutral-500">
          <div className="flex items-center justify-center space-x-4 mb-2 font-mono">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('privacy-policy');
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
                onNavigate('about');
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
                onNavigate('terms-of-service');
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

      {/* Detail Modal for IP & Location (if clicked in overview preview) */}
      {detailModalSession && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setDetailModalSession(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Session Node Telemetry
                </h3>
              </div>
              <button
                onClick={() => setDetailModalSession(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 tracking-wider">Device Name</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {detailModalSession.device_name || 'Generic Web Device'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 tracking-wider">IP Address</span>
                  <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white select-all">
                    {detailModalSession.ip_address || '127.0.0.1'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 tracking-wider">Status</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {getSessionStatus(detailModalSession).label}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 tracking-wider">Geo-Location Metadata</span>
                <span className="text-xs font-medium text-gray-800 dark:text-white/90 flex items-start gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span>{detailModalSession.location || 'Unknown Location'}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 tracking-wider">Session Started</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-white/90">
                    {formatDateTime(detailModalSession.created_at).full}
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-white/40 tracking-wider">Last Activity</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-white/90">
                    {formatDateTime(detailModalSession.last_active_at).full}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-end">
              <button
                onClick={() => setDetailModalSession(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Sign Out */}
      <ConfirmationModal
        isOpen={isSignOutConfirmOpen}
        onClose={() => setIsSignOutConfirmOpen(false)}
        onConfirm={handleSignOut}
        title="Sign Out of Ceaznet?"
        message="Are you sure you want to sign out? Your current active session token will be closed on this device."
        confirmButtonText="Sign Out"
        confirmButtonVariant="danger"
      />
    </>
  );
};

export default ProfileView;
