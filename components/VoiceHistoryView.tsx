import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../services/supabaseClient';
import { deleteConversation } from '../services/dbService';
import { Loader } from 'lucide-react';
import { AppIcon } from './core/AppIcon';
import { format } from 'date-fns';
import { InlineConfirmDelete } from './core/InlineConfirmDelete';
import { UserProfile } from '../types';
import FloatingHeader from './FloatingHeader';
import { SystemBanner } from './SystemBanner';
import { getFileUrlFromTelegram } from '../services/telegramStorage';
import { useGlobalModal } from './core/GlobalModalProvider';

interface VoiceConversation {
    id: string;
    title: string;
    created_at: string;
    audio_url: string | null;
    messages?: any[];
}

interface VoiceHistoryViewProps {
    onBack: () => void;
    user: any;
    userProfile: UserProfile;
    isSaving?: boolean;
    showBackButton?: boolean;
    onOpenSidebar?: () => void;
    searchQuery: string;
    onNavigate: (view: any) => void;
    onLogout: () => void;
    onOpenAuthModal: () => void;
    onOpenProfileModal: () => void;
    isSuspended?: boolean;
    voiceHistoryVersion?: number;
    setVoiceHistoryHeaderState?: (state: {
        title: string | null;
        subtitle?: string | null;
        onBack?: () => void;
    }) => void;
}

const ExpandedVoiceView: React.FC<{ 
    conversation: VoiceConversation; 
    onClose: () => void;
    userProfile: UserProfile;
    onNavigate: (view: any) => void;
    onLogout: () => void;
    onOpenAuthModal: () => void;
    onOpenProfileModal: () => void;
    user: any;
    isSuspended?: boolean;
    onNotFound?: (id: string) => void;
}> = ({ conversation, onClose, userProfile, onNavigate, onLogout, onOpenAuthModal, onOpenProfileModal, user, isSuspended, onNotFound }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
    const [isAudioLoading, setIsAudioLoading] = useState(!!conversation.audio_url);
    const animationFrameRef = useRef<number | null>(null);
    
    // Fix for Infinity duration
    const isFixingDuration = useRef(false);

    const [activeMessageIndex, setActiveMessageIndex] = useState<number>(-1);

    // Calculate total character count for approximate syncing
    const totalChars = conversation.messages.reduce((acc, msg) => acc + (msg.text?.length || 0), 0);

    const onNotFoundRef = useRef(onNotFound);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onNotFoundRef.current = onNotFound;
        onCloseRef.current = onClose;
    }, [onNotFound, onClose]);

    useEffect(() => {
        const resolveUrl = async () => {
            console.log('[VoiceHistoryView] Starting to resolve URL for conversation:', conversation.id);
            console.log('[VoiceHistoryView] Original audio_url:', conversation.audio_url);
            
            if (conversation.audio_url) {
                if (conversation.audio_url.startsWith('tg://')) {
                    try {
                        console.log('[VoiceHistoryView] URL is a Telegram scheme. Calling getFileUrlFromTelegram...');
                        const url = await getFileUrlFromTelegram(conversation.audio_url);
                        console.log('[VoiceHistoryView] getFileUrlFromTelegram returned:', url);
                        if (url === '__NOT_FOUND__') {
                            console.warn('[VoiceHistoryView] Audio file not found in Telegram. It might have been deleted.');
                            setResolvedAudioUrl(null);
                            setIsAudioLoading(false);
                            if (onNotFoundRef.current) {
                                onNotFoundRef.current(conversation.id);
                                onCloseRef.current();
                            }
                        } else if (url) {
                            setResolvedAudioUrl(url);
                        } else {
                            console.warn('[VoiceHistoryView] Resolved URL is empty or null.');
                            setResolvedAudioUrl(null);
                            setIsAudioLoading(false);
                        }
                    } catch (err) {
                        console.error('[VoiceHistoryView] Failed to resolve Telegram audio URL:', err);
                        setResolvedAudioUrl(null);
                        setIsAudioLoading(false);
                    }
                } else {
                    console.log('[VoiceHistoryView] URL is not a Telegram scheme. Using as-is.');
                    setResolvedAudioUrl(conversation.audio_url);
                }
            } else {
                console.warn('[VoiceHistoryView] No audio_url found in conversation.');
                setResolvedAudioUrl(null);
                setIsAudioLoading(false);
            }
        };
        resolveUrl();
    }, [conversation.audio_url, conversation.id]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            console.log('[VoiceHistoryView] audioRef is null, skipping event listeners.');
            return;
        }

        let animationFrameId: number;
        let loadingTimeoutId: NodeJS.Timeout;

        // Failsafe timeout to prevent infinite loading state
        loadingTimeoutId = setTimeout(() => {
            if (isAudioLoading) {
                console.warn('[VoiceHistoryView] Audio loading timed out after 15 seconds. Forcing loading state to false.');
                setIsAudioLoading(false);
            }
        }, 15000);

        const updateVisuals = () => {
            const current = audio.currentTime;
            const dur = audio.duration;
            
            setCurrentTime(current);
            
            if (isFinite(dur) && dur > 0) {
                const prog = current / dur;
                setProgress(prog * 100);

                // Approximate current message based on character count OR use timestamps if available
                let foundIndex = -1;
                
                // Check if we have timestamps (heuristic: check first few messages)
                const hasTimestamps = conversation.messages.some((m: any) => m.startTime !== undefined);

                if (hasTimestamps) {
                    // Use precise timestamps
                    for (let i = 0; i < conversation.messages.length; i++) {
                        const msg = conversation.messages[i] as any;
                        if (msg.startTime !== undefined && msg.endTime !== undefined) {
                            // Add a small buffer (0.2s) to make transitions smoother
                            if (current >= msg.startTime - 0.2 && current <= msg.endTime + 0.2) {
                                foundIndex = i;
                                break;
                            }
                        }
                    }
                    // If between messages (silence), keep the last active one or none? 
                    // Let's keep none to show "silence" or maybe the last one if it was very recent.
                    // For now, simple strict check.
                } else if (totalChars > 0) {
                    // Fallback to character count approximation
                    const estimatedCharIndex = prog * totalChars;
                    let runningCharCount = 0;
                    
                    for (let i = 0; i < conversation.messages.length; i++) {
                        const msgLen = conversation.messages[i].text?.length || 0;
                        if (estimatedCharIndex >= runningCharCount && estimatedCharIndex < runningCharCount + msgLen) {
                            foundIndex = i;
                            break;
                        }
                        runningCharCount += msgLen;
                    }
                }
                setActiveMessageIndex(foundIndex);
            }

            if (!audio.paused) {
                animationFrameId = requestAnimationFrame(updateVisuals);
            }
        };

        const onPlay = () => {
            setIsPlaying(true);
            updateVisuals();
        };

        const onPause = () => {
            setIsPlaying(false);
            cancelAnimationFrame(animationFrameId);
        };

        const setAudioDuration = () => {
            console.log('[VoiceHistoryView] setAudioDuration called. audio.duration:', audio.duration);
            setIsAudioLoading(false); // Metadata loaded, we can enable the play button
            clearTimeout(loadingTimeoutId);
            const dur = audio.duration;
            if (dur === Infinity) {
                console.log('[VoiceHistoryView] Duration is Infinity. Attempting fix...');
                if (isFixingDuration.current) return;
                isFixingDuration.current = true;
                audio.currentTime = 1e101;
                audio.ontimeupdate = () => {
                    audio.ontimeupdate = null;
                    audio.currentTime = 0;
                    isFixingDuration.current = false;
                    console.log('[VoiceHistoryView] Fixed duration:', audio.duration);
                    setDuration(audio.duration);
                };
            } else if (isFinite(dur)) {
                console.log('[VoiceHistoryView] Setting finite duration:', dur);
                setDuration(dur);
            }
        };

        const handleEnded = () => {
            console.log('[VoiceHistoryView] Audio ended.');
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
            setActiveMessageIndex(-1);
            cancelAnimationFrame(animationFrameId);
        };

        const handleCanPlay = () => {
            console.log('[VoiceHistoryView] Audio canplay event fired.');
            setIsAudioLoading(false);
            clearTimeout(loadingTimeoutId);
        };

        const handleError = (e: Event) => {
            console.error('[VoiceHistoryView] Error loading audio. Event:', e);
            if (audio.error) {
                console.error('[VoiceHistoryView] Audio Error Details:', {
                    code: audio.error.code,
                    message: audio.error.message
                });
            } else {
                console.error('[VoiceHistoryView] Unknown audio error occurred.');
            }
            setIsAudioLoading(false);
            clearTimeout(loadingTimeoutId);
        };

        const handleLoadStart = () => {
            console.log('[VoiceHistoryView] Audio loadstart event fired.');
        };

        const handleWaiting = () => {
            console.log('[VoiceHistoryView] Audio waiting event fired.');
            setIsAudioLoading(true);
        };

        const handlePlaying = () => {
            console.log('[VoiceHistoryView] Audio playing event fired.');
            setIsAudioLoading(false);
        };

        // Initialize if metadata already loaded
        console.log('[VoiceHistoryView] Initial audio.readyState:', audio.readyState);
        if (audio.readyState >= 1) {
            console.log('[VoiceHistoryView] ReadyState >= 1 on mount. Calling setAudioDuration.');
            setIsAudioLoading(false);
            setAudioDuration();
        }

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('loadedmetadata', setAudioDuration);
        audio.addEventListener('durationchange', setAudioDuration);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('waiting', handleWaiting);
        audio.addEventListener('playing', handlePlaying);
        // Fallback timeupdate for when not playing (seeking etc)
        audio.addEventListener('timeupdate', updateVisuals);

        return () => {
            cancelAnimationFrame(animationFrameId);
            clearTimeout(loadingTimeoutId);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('loadedmetadata', setAudioDuration);
            audio.removeEventListener('durationchange', setAudioDuration);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('waiting', handleWaiting);
            audio.removeEventListener('playing', handlePlaying);
            audio.removeEventListener('timeupdate', updateVisuals);
        };
    }, [totalChars, resolvedAudioUrl]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newProgress = parseFloat(e.target.value);
        setProgress(newProgress); // Instant update UI
        
        if (audioRef.current && isFinite(duration) && duration > 0) {
            const newTime = (newProgress / 100) * duration;
            audioRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const formatTime = (time: number) => {
        if (!isFinite(time) || isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const skipForward = () => {
        if (audioRef.current) audioRef.current.currentTime += 10;
    };

    const skipBackward = () => {
        if (audioRef.current) audioRef.current.currentTime -= 10;
    };

    const isLoadingAudio = isAudioLoading || (!resolvedAudioUrl && Boolean(conversation.audio_url));

    return (
        <div 
            className="flex flex-col h-full bg-[#F9F6F2] dark:bg-black text-neutral-800 dark:text-white relative overflow-hidden"
        >
            {/* Atmospheric background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] rounded-full bg-amber-500/10 blur-[120px] transition-all duration-1000 ${isPlaying ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
            </div>

            {/* Content & Transcript Layout with generous top clearance for FloatingHeader */}
            <div className="flex-1 overflow-y-auto scrollbar-hide pt-24 sm:pt-28 md:pt-32 pb-48 relative z-10">
                <div className="max-w-4xl mx-auto px-6 md:px-12">
                    {/* Transcript */}
                    <div className="space-y-8 md:space-y-6">
                        {conversation.messages?.map((msg, idx) => {
                            return (
                                <div key={idx} className="transition-all duration-300 opacity-100 scale-100">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2 md:mb-1">
                                        {msg.role === 'user' ? 'You' : 'Ceaznet'}
                                    </p>
                                    <p className={`text-xl md:text-2xl font-light leading-snug ${msg.role === 'user' ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-900 dark:text-white font-serif'}`}>
                                        {msg.text}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Minimal Player Controls - Anchored inside bottom */}
            <div 
                className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#F9F6F2] via-[#F9F6F2]/95 to-transparent dark:from-black dark:via-black/95 pb-safe pt-16 z-20 pointer-events-auto"
                style={{ paddingBottom: 'calc(var(--dev-console-padding, 0px) + 1.5rem)' }}
            >
                <div className="max-w-4xl mx-auto px-6 md:px-12 pb-4 md:pb-2">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={skipBackward}
                                disabled={isLoadingAudio || !resolvedAudioUrl}
                                className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed group cursor-pointer"
                                aria-label="Rewind 10 seconds"
                                title="Rewind 10s"
                            >
                                <AppIcon name="solar:rewind-10-seconds-back-linear" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>

                            <button 
                                onClick={togglePlay}
                                disabled={isLoadingAudio || !resolvedAudioUrl}
                                className="w-16 h-16 md:w-16 md:h-16 shrink-0 rounded-full border border-neutral-300 dark:border-white/20 flex items-center justify-center text-neutral-800 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 transition-all disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
                                aria-label={isLoadingAudio ? "Loading audio from Telegram..." : isPlaying ? "Pause" : "Play"}
                            >
                                {isLoadingAudio ? (
                                    <Loader className="w-6 h-6 md:w-6 md:h-6 animate-spin text-amber-500" />
                                ) : isPlaying ? (
                                    <AppIcon name="solar:pause-linear" className="w-6 h-6 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <AppIcon name="solar:play-linear" className="w-6 h-6 md:w-6 md:h-6 ml-0.5 group-hover:scale-110 transition-transform" />
                                )}
                            </button>

                            <button
                                onClick={skipForward}
                                disabled={isLoadingAudio || !resolvedAudioUrl}
                                className="w-10 h-10 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed group cursor-pointer"
                                aria-label="Forward 10 seconds"
                                title="Forward 10s"
                            >
                                <AppIcon name="solar:rewind-10-seconds-forward-linear" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                        <div className="flex-1 relative">
                            <div className="relative h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden cursor-pointer">
                                <div 
                                    className="absolute top-0 left-0 h-full bg-neutral-900 dark:bg-white rounded-full transition-all duration-100"
                                    style={{ width: `${progress}%` }}
                                />
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={progress || 0}
                                    onChange={handleSeek}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                            <div className="absolute top-4 left-0 right-0 flex justify-between text-[11px] font-mono tracking-wider text-neutral-500">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {resolvedAudioUrl && (
                    <audio ref={audioRef} src={resolvedAudioUrl} preload="auto" />
                )}
            </div>
        </div>
    );
};

// Shared module-level state to cache and deduplicate user conversations fetches (especially across fast React remounts/Strict Mode/route transitions)
let cachedConversations: VoiceConversation[] | null = null;
let cachedVersion: number = -1;
let pendingHistoryPromise: Promise<any> | null = null;

const VoiceHistoryView: React.FC<VoiceHistoryViewProps> = ({ onBack, user, userProfile, isSaving, showBackButton, onOpenSidebar, searchQuery, onNavigate, onLogout, onOpenAuthModal, onOpenProfileModal, isSuspended, voiceHistoryVersion = 0, setVoiceHistoryHeaderState }) => {
    const { alert: globalAlert } = useGlobalModal();
    const [conversations, setConversationsState] = useState<VoiceConversation[]>(cachedConversations || []);
    
    const setConversations = (val: VoiceConversation[] | ((prev: VoiceConversation[]) => VoiceConversation[])) => {
        if (typeof val === 'function') {
            setConversationsState(prev => {
                const next = val(prev);
                cachedConversations = next;
                return next;
            });
        } else {
            cachedConversations = val;
            setConversationsState(val);
        }
    };

    const [isLoading, setIsLoading] = useState(!cachedConversations);
    const [selectedConversation, setSelectedConversation] = useState<VoiceConversation | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [dataLoaded, setDataLoaded] = useState(!!cachedConversations);
    
    const location = useLocation();
    const navigate = useNavigate();
    
    const urlConversationId = React.useMemo(() => {
        const parts = location.pathname.split('/');
        if (parts.length >= 3 && parts[1] === 'voice-history' && parts[2]) {
            return parts[2];
        }
        return null;
    }, [location.pathname]);

    // Synchronously adjust state during render when URL parameter changes
    const prevUrlConvoIdRef = useRef<string | null>(urlConversationId);
    if (prevUrlConvoIdRef.current !== urlConversationId) {
        prevUrlConvoIdRef.current = urlConversationId;
        if (!urlConversationId) {
            if (selectedConversation !== null) setSelectedConversation(null);
        } else {
            const conv = conversations.find(c => c.id === urlConversationId);
            if (conv && selectedConversation?.id !== urlConversationId) {
                setSelectedConversation(conv);
            }
        }
    }

    // Sync header state with FloatingHeader
    useEffect(() => {
        if (selectedConversation) {
            setVoiceHistoryHeaderState?.({
                title: selectedConversation.title || 'Untitled Session',
                subtitle: format(new Date(selectedConversation.created_at), 'MMMM d, yyyy • h:mm a'),
                onBack: () => {
                    setSelectedConversation(null);
                    if (location.pathname.startsWith('/voice-history/')) {
                        navigate('/voice-history', { replace: true });
                    }
                }
            });
        } else {
            setVoiceHistoryHeaderState?.({ title: null });
        }

        return () => {
            setVoiceHistoryHeaderState?.({ title: null });
        };
    }, [selectedConversation?.id, selectedConversation?.title, selectedConversation?.created_at, location.pathname, navigate, setVoiceHistoryHeaderState]);
    

    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const isFetchingRef = useRef(false);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const prevVersionRef = useRef(voiceHistoryVersion);

    useEffect(() => {
        if (!dataLoaded || isLoading) return;
        
        if (urlConversationId) {
            const conv = conversations.find(c => c.id === urlConversationId);
            if (conv) {
                if (selectedConversation?.id !== urlConversationId) {
                    // If messages are missing (from initial shallow fetch), fetch them
                    if (!conv.messages) {
                        const fetchFull = async () => {
                            try {
                                const { data, error } = await supabase
                                    .from('conversations')
                                    .select('*')
                                    .eq('id', conv.id)
                                    .single();
                                if (!error && data) {
                                    const fullConvo = data as VoiceConversation;
                                    setConversations(prev => prev.map(c => c.id === conv.id ? fullConvo : c));
                                    setSelectedConversation(fullConvo);
                                }
                            } catch (e) {
                                console.error('Error fetching full conversation on direct nav:', e);
                            }
                        };
                        fetchFull();
                    } else {
                        setSelectedConversation(conv);
                    }
                }
            } else if (!user) {
                navigate('/404', { replace: true });
            } else {
                // If not found in current list, try to fetch it directly from DB
                const fetchMissing = async () => {
                    try {
                        const { data, error } = await supabase
                            .from('conversations')
                            .select('*')
                            .eq('id', urlConversationId)
                            .single();
                        if (!error && data) {
                            const fullConvo = data as VoiceConversation;
                            setConversations(prev => [fullConvo, ...prev]);
                            setSelectedConversation(fullConvo);
                        } else {
                            navigate('/404', { replace: true });
                        }
                    } catch (e) {
                        navigate('/404', { replace: true });
                    }
                };
                fetchMissing();
            }
        }
    }, [urlConversationId, dataLoaded, isLoading, conversations, selectedConversation, user, navigate]);

    const prevIsSaving = useRef(isSaving);
    const prevUserId = useRef(user?.id);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!user) {
                setIsLoading(false);
                setDataLoaded(true);
                return;
            }
            
            // If we already have cached conversations for this user, and we're not reloading, skip
            if (cachedConversations && prevUserId.current === user.id && dataLoaded && !isFetchingRef.current) {
                setIsLoading(false);
                setDataLoaded(true);
                return;
            }

            if (isFetchingRef.current) return;
            isFetchingRef.current = true;
            if (conversations.length === 0) setIsLoading(true);
            
            try {
                // If there's already an active fetch promise, wait for/re-use it
                if (!pendingHistoryPromise) {
                    pendingHistoryPromise = Promise.resolve(
                        supabase
                            .from('conversations')
                            .select('id, title, created_at, audio_url, user_id')
                            .eq('user_id', user.id)
                            .eq('is_voice_conversation', true)
                            .order('created_at', { ascending: false })
                    )
                        .then(res => {
                            pendingHistoryPromise = null;
                            return res;
                        })
                        .catch(err => {
                            pendingHistoryPromise = null;
                            throw err;
                        });
                }

                const { data, error } = await pendingHistoryPromise;

                if (error) {
                    console.error('Error fetching voice history:', error);
                } else {
                    const fetchedData = data || [];
                    setConversations(fetchedData);
                    // If the selected conversation was updated, update it too
                    setSelectedConversation(prev => {
                        if (prev) {
                            const updatedSelected = fetchedData.find(c => c.id === prev.id);
                            if (updatedSelected && updatedSelected.audio_url !== prev.audio_url) {
                                return updatedSelected;
                            }
                        }
                        return prev;
                    });
                }
            } catch (err) {
                console.error('Failed to fetch history:', err);
            } finally {
                setIsLoading(false);
                setDataLoaded(true);
                isFetchingRef.current = false;
            }
        };

        const userChanged = user?.id !== prevUserId.current;
        const saveFinished = prevIsSaving.current === true && isSaving === false;
        const versionChanged = voiceHistoryVersion !== cachedVersion;

        // If user changed, save completed, or version changed, invalidate the cache
        if (userChanged || saveFinished || versionChanged) {
            cachedConversations = null;
            cachedVersion = voiceHistoryVersion;
            pendingHistoryPromise = null;
            setDataLoaded(false);
            setIsLoading(true);
        }

        if (!dataLoaded || userChanged || saveFinished || versionChanged) {
            fetchHistory();
            if (user) prevUserId.current = user.id;
        }

        prevIsSaving.current = isSaving;
        prevVersionRef.current = voiceHistoryVersion;
    }, [user?.id, isSaving, dataLoaded, voiceHistoryVersion]);

    useEffect(() => {
        if (!user || conversations.length === 0) {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // Only poll if any of the RECENT (last 10) conversations are missing audio_url
        // This prevents infinite polling for old failed uploads
        const recentConvos = conversations.slice(0, 10);
        const hasPendingUploads = recentConvos.some(c => c.audio_url === null);
        
        if (!hasPendingUploads) {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // If already polling, don't start another interval
        if (pollIntervalRef.current) return;

        const pollHistory = async () => {
            // Use the same deduplicated logic for polling too
            if (isFetchingRef.current || pendingHistoryPromise) return;
            
            console.log('[VoiceHistoryView] Polling for pending uploads...');
            try {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('id, title, created_at, audio_url, user_id')
                    .eq('user_id', user.id)
                    .eq('is_voice_conversation', true)
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setConversations(data);
                    
                    // Stop polling if nothing is pending in the recent ones
                    const stillPending = data.slice(0, 10).some(c => c.audio_url === null);
                    if (!stillPending && pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                }
            } catch (err) {
                console.error('[VoiceHistoryView] Poll failed:', err);
            }
        };

        pollIntervalRef.current = setInterval(pollHistory, 5000);
        
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [user?.id, conversations]);

    const handleDeleteInline = async (id: string) => {
        if (isSuspended) {
            globalAlert("Delete blocked: Account suspended.", { type: 'danger' });
            return;
        }
        
        try {
            await deleteConversation(id, user);
            setConversations(prev => prev.filter(c => c.id !== id));
            if (selectedConversation?.id === id) {
                setSelectedConversation(null);
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            globalAlert('Failed to delete conversation. Please check your connection and try again.', { type: 'danger' });
        }
    };

    const handleConversationClick = async (convo: VoiceConversation) => {
        // If messages aren't loaded yet, fetch the full conversation
        if (!convo.messages) {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('id', convo.id)
                    .single();
                
                if (!error && data) {
                    const fullConvo = data as VoiceConversation;
                    // Update our list with the full data so we don't fetch it again
                    setConversations(prev => prev.map(c => c.id === convo.id ? fullConvo : c));
                    setSelectedConversation(fullConvo);
                }
            } catch (err) {
                console.error('Error fetching full conversation:', err);
            } finally {
                setIsLoading(false);
            }
        } else {
            setSelectedConversation(convo);
        }
        navigate(`/voice-history/${convo.id}`);
    };

    const filteredConversations = conversations.filter(c => 
        c.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedConversation) {
        return (
            <ExpandedVoiceView 
                key={selectedConversation.id}
                conversation={selectedConversation} 
                onClose={() => {
                    setSelectedConversation(null);
                    if (location.pathname.startsWith('/voice-history/')) {
                        navigate('/voice-history', { replace: true });
                    }
                }}
                userProfile={userProfile}
                onNavigate={onNavigate}
                onLogout={onLogout}
                onOpenAuthModal={onOpenAuthModal}
                onOpenProfileModal={onOpenProfileModal}
                user={user}
                isSuspended={isSuspended}
                onNotFound={(id) => {
                    // Automatically delete if audio is not found in Telegram
                    if (!isSuspended) {
                        deleteConversation(id, user).then(() => {
                            setConversations(prev => prev.filter(c => c.id !== id));
                        });
                    }
                }}
            />
        );
    }

    return (
        <div 
            className="flex flex-col h-full bg-[#F9F6F2] dark:bg-black text-neutral-800 dark:text-white pt-16 sm:pt-20"
        >
            {/* Header Section */}
            <div className="px-6 md:px-12 pb-6 pt-4 border-b border-neutral-200/80 dark:border-white/10">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-light text-neutral-900 dark:text-white tracking-tighter mb-3">
                    Recordings.
                </h1>
                <div className="flex items-center gap-3 text-xs tracking-widest uppercase text-neutral-500 dark:text-white/50">
                    <span>{conversations.length} Sessions</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
                    <span>Voice History</span>
                </div>
            </div>

            {/* Content Area */}
            <div 
                className="flex-1 overflow-y-auto scrollbar-hide transition-[padding] duration-300"
                style={{ paddingBottom: 'calc(var(--dev-console-padding, 0px) + 2rem)' }}
            >
                {isSaving && (
                    <div className="m-6 max-w-md mx-auto bg-neutral-100 dark:bg-white/[0.04] rounded-2xl p-4 flex items-center justify-center gap-3 animate-pulse border border-neutral-200 dark:border-white/10">
                        <Loader className="w-5 h-5 text-neutral-500 animate-spin" />
                        <span className="text-neutral-600 dark:text-neutral-400 font-medium text-sm">Saving session...</span>
                    </div>
                )}

                {isLoading && conversations.length === 0 ? (
                    <div className="flex flex-col">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 border-b border-neutral-200 dark:border-white/5 bg-neutral-100/50 dark:bg-white/[0.01] animate-pulse" />
                        ))}
                    </div>
                ) : filteredConversations.length === 0 && !isSaving ? (
                    <div className="flex flex-col items-center justify-center h-96 text-neutral-400">
                        <AppIcon name="hugeicons:voice" className="w-12 h-12 mb-3 text-neutral-300 dark:text-neutral-700" />
                        <h3 className="text-2xl font-light text-neutral-900 dark:text-white mb-2">No recordings</h3>
                        <p className="text-sm max-w-xs text-center opacity-60">
                            {searchQuery ? 'Try adjusting your search terms.' : 'Start a new conversation to see it appear here.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {filteredConversations.map(convo => (
                            <div 
                                key={convo.id} 
                                onClick={() => handleConversationClick(convo)}
                                className="group relative flex items-center justify-between py-4 px-6 md:py-4 md:px-8 border-b border-neutral-200/80 dark:border-white/10 hover:bg-neutral-100/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-4 md:gap-5">
                                    <div className="w-8 h-8 shrink-0 flex items-center justify-center text-neutral-500 dark:text-neutral-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                        <AppIcon name="solar:play-linear" className="w-5 h-5 ml-0.5 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg md:text-xl font-light text-neutral-900 dark:text-white mb-0.5 group-hover:translate-x-0.5 transition-transform duration-200">
                                            {convo.title || 'Untitled Session'}
                                        </h3>
                                        <div className="flex items-center gap-3 text-[10px] md:text-xs text-neutral-500 dark:text-white/40 tracking-wider uppercase font-mono">
                                            <span>{format(new Date(convo.created_at), 'MMM d, yyyy')}</span>
                                            <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
                                            <span>{format(new Date(convo.created_at), 'h:mm a')}</span>
                                            {convo.messages?.length > 0 && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
                                                    <span>{convo.messages.length} msgs</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4 relative">
                                    {deletingId === convo.id ? (
                                        <div className="p-2 text-neutral-400">
                                            <Loader className="w-5 h-5 animate-spin text-amber-500" />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => {
                                                 e.stopPropagation();
                                                setOpenDropdownId(openDropdownId === convo.id ? null : convo.id);
                                            }}
                                            className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                                            aria-label="More options"
                                        >
                                            <AppIcon name="solar:menu-dots-linear" className="w-5 h-5 hover:scale-110 transition-transform" />
                                        </button>
                                    )}
                                    
                                    {openDropdownId === convo.id && !deletingId && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); setConfirmingDeleteId(null); }} />
                                            <div className="absolute right-0 top-full mt-1.5 w-max max-w-[260px] bg-white dark:bg-[#121214] rounded-2xl border border-neutral-200/90 dark:border-white/15 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                                {convo.audio_url && confirmingDeleteId !== convo.id && (
                                                    <button 
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            setOpenDropdownId(null);
                                                            try {
                                                                let url = convo.audio_url;
                                                                if (url && url.startsWith('tg://')) {
                                                                    url = await getFileUrlFromTelegram(url);
                                                                }
                                                                if (url === '__NOT_FOUND__') {
                                                                    globalAlert('Audio file not found. It might have been deleted from Telegram.', { type: 'danger' });
                                                                    if (!isSuspended) {
                                                                        deleteConversation(convo.id, user).then(() => {
                                                                            setConversations(prev => prev.filter(c => c.id !== convo.id));
                                                                        });
                                                                    }
                                                                } else if (url) {
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = `Recording-${format(new Date(convo.created_at), 'yyyy-MM-dd')}.webm`;
                                                                    document.body.appendChild(a);
                                                                    a.click();
                                                                    document.body.removeChild(a);
                                                                }
                                                            } catch (err) {
                                                                console.error('Failed to download audio', err);
                                                                globalAlert('Failed to download audio. Please try again.', { type: 'danger' });
                                                            }
                                                        }}
                                                        className="w-full text-left px-3.5 py-2.5 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors border-b border-neutral-100 dark:border-white/5 cursor-pointer whitespace-nowrap"
                                                    >
                                                        <AppIcon name="solar:download-minimalistic-linear" className="w-4 h-4 text-neutral-500" />
                                                        <span className="text-xs sm:text-sm font-medium">Download Audio</span>
                                                    </button>
                                                )}
                                                {confirmingDeleteId === convo.id ? (
                                                    <div className="p-3 bg-red-50/70 dark:bg-red-950/30 space-y-2 w-max max-w-[240px]">
                                                        <div className="flex items-center gap-2">
                                                            <AppIcon name="solar:danger-triangle-linear" className="w-4 h-4 text-red-500 shrink-0" />
                                                            <p className="text-xs font-semibold text-red-600 dark:text-red-400 leading-tight">
                                                                Delete recording?
                                                            </p>
                                                        </div>
                                                        <p className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-snug">
                                                            This action cannot be undone and will permanently delete this session.
                                                        </p>
                                                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-200/50 dark:border-red-900/40">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setConfirmingDeleteId(null);
                                                                }}
                                                                className="px-2.5 py-1 text-xs font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenDropdownId(null);
                                                                    setConfirmingDeleteId(null);
                                                                    handleDeleteInline(convo.id);
                                                                }}
                                                                className="px-3 py-1 text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 active:bg-red-800 transition-colors shadow-xs cursor-pointer"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setConfirmingDeleteId(convo.id);
                                                        }}
                                                        className="w-full px-3.5 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-start gap-2.5 transition-colors text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
                                                    >
                                                        <AppIcon name="solar:trash-bin-trash-linear" className="w-4 h-4" />
                                                        <span>Delete Session</span>
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceHistoryView;
