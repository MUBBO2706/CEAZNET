import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { deleteConversation } from '../services/dbService';
import { ArrowLeft, Play, Pause, Calendar, Clock, Trash2, FileAudio, Loader2, User, Bot, ChevronDown, ChevronUp, Volume2, Mic, Activity, Search, Filter, Menu, X, SkipBack, SkipForward, Maximize2, Minimize2, MoreVertical, Download, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmationModal from './ConfirmationModal';
import { UserProfile } from '../types';
import FloatingHeader from './FloatingHeader';
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
    onNotFound?: (id: string) => void;
}> = ({ conversation, onClose, userProfile, onNavigate, onLogout, onOpenAuthModal, onOpenProfileModal, user, onNotFound }) => {
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

    return (
        <div className="fixed inset-0 z-50 bg-neutral-100 dark:bg-[#050505] flex flex-col animate-in slide-in-from-bottom-10 duration-500">
            {/* Atmospheric background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] rounded-full bg-amber-500/10 blur-[120px] transition-all duration-1000 ${isPlaying ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
            </div>

            {/* Floating Header */}
            <FloatingHeader
                onOpenSidebar={() => {}} // No-op in modal
                user={user}
                userProfile={userProfile}
                onOpenAuthModal={onOpenAuthModal}
                onOpenProfileModal={onOpenProfileModal}
                onLogout={onLogout}
                onNavigate={onNavigate}
                currentView="voice-history"
                expandedVoiceTitle={conversation.title || 'Untitled Session'}
                expandedVoiceSubtitle={format(new Date(conversation.created_at), 'MMMM d, yyyy • h:mm a')}
                onExpandedVoiceBack={onClose}
            />

            <div className="flex-1 overflow-y-auto scrollbar-hide pt-32 pb-48 relative z-10">
                <div className="max-w-4xl mx-auto px-6 md:px-12">
                    
                    {/* Transcript */}
                    <div className="space-y-12 md:space-y-6">
                        {conversation.messages.map((msg, idx) => {
                            return (
                                <div key={idx} className="transition-all duration-700 opacity-100 scale-100">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3 md:mb-1">
                                        {msg.role === 'user' ? 'You' : 'Ceaznet'}
                                    </p>
                                    <p className={`text-2xl md:text-2xl font-light leading-snug ${msg.role === 'user' ? 'text-neutral-600 dark:text-neutral-300' : 'text-neutral-900 dark:text-white font-serif'}`}>
                                        {msg.text}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Minimal Player Controls */}
            <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-neutral-100 via-neutral-100/90 to-transparent dark:from-[#050505] dark:via-[#050505]/90 pb-safe pt-24 z-20">
                <div className="max-w-4xl mx-auto px-6 md:px-12 pb-8 md:pb-4">
                    <div className="flex items-center gap-6 md:gap-6">
                        <button 
                            onClick={togglePlay}
                            disabled={isAudioLoading || !resolvedAudioUrl}
                            className="w-16 h-16 md:w-16 md:h-16 shrink-0 rounded-full border border-neutral-300 dark:border-white/20 flex items-center justify-center hover:bg-neutral-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isAudioLoading ? (
                                <Loader2 className="w-6 h-6 md:w-6 md:h-6 animate-spin text-neutral-500" />
                            ) : isPlaying ? (
                                <Pause className="w-6 h-6 md:w-6 md:h-6 fill-current" />
                            ) : (
                                <Play className="w-6 h-6 md:w-6 md:h-6 ml-1.5 fill-current" />
                            )}
                        </button>

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

const VoiceHistoryView: React.FC<VoiceHistoryViewProps> = ({ onBack, user, userProfile, isSaving, showBackButton, onOpenSidebar, searchQuery, onNavigate, onLogout, onOpenAuthModal, onOpenProfileModal, isSuspended, voiceHistoryVersion = 0 }) => {
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
    const [dataLoaded, setDataLoaded] = useState(!!cachedConversations);
    
    const location = useLocation();
    const navigate = useNavigate();
    
    const urlConversationId = React.useMemo(() => {
        const parts = location.pathname.split('/');
        if (parts.length >= 3 && parts[1] === 'voice-history') {
            return parts[2];
        }
        return null;
    }, [location.pathname]);
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
        } else if (!urlConversationId && selectedConversation) {
            setSelectedConversation(null);
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
                    pendingHistoryPromise = supabase
                        .from('conversations')
                        .select('id, title, created_at, audio_url, user_id')
                        .eq('user_id', user.id)
                        .eq('is_voice_conversation', true)
                        .order('created_at', { ascending: false })
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

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (isSuspended) {
            globalAlert("Delete blocked: Account suspended.", { type: 'danger' });
            return;
        }
        if (!itemToDelete) return;
        
        const id = itemToDelete;
        setDeletingId(id);
        
        try {
            await deleteConversation(id, user);
            setConversations(prev => prev.filter(c => c.id !== id));
            if (selectedConversation?.id === id) {
                setSelectedConversation(null);
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            globalAlert('Failed to delete conversation. Please check your connection and try again.', { type: 'danger' });
        } finally {
            setDeletingId(null);
            setItemToDelete(null);
            setIsDeleteModalOpen(false);
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

    return (
        <div className="flex flex-col h-full bg-neutral-50 dark:bg-[#050505] text-neutral-800 dark:text-white pt-20 md:pt-24">
            
            {/* Header Section */}
            <div className="px-6 md:px-12 pb-8 pt-6 border-b border-neutral-200 dark:border-white/10">
                <h1 className="text-5xl md:text-7xl font-serif font-light text-neutral-900 dark:text-white tracking-tighter mb-4">
                    Recordings.
                </h1>
                <div className="flex items-center gap-4 text-xs tracking-widest uppercase text-neutral-500">
                    <span>{conversations.length} Sessions</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700"></span>
                    <span>Voice History</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide dev-console-spacing-pb">
                {isSaving && (
                    <div className="m-6 max-w-md mx-auto bg-neutral-100 dark:bg-white/5 rounded-2xl p-4 flex items-center justify-center gap-3 animate-pulse">
                        <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
                        <span className="text-neutral-600 dark:text-neutral-400 font-medium text-sm">Saving session...</span>
                    </div>
                )}

                {isLoading && conversations.length === 0 ? (
                    <div className="flex flex-col">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 border-b border-neutral-200 dark:border-white/5 bg-neutral-100/50 dark:bg-white/[0.02] animate-pulse" />
                        ))}
                    </div>
                ) : filteredConversations.length === 0 && !isSaving ? (
                    <div className="flex flex-col items-center justify-center h-96 text-neutral-400">
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
                                className="group relative flex items-center justify-between py-6 px-6 md:py-4 md:px-8 border-b border-neutral-200 dark:border-white/10 hover:bg-white dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-6 md:gap-4">
                                    <div className="w-12 h-12 md:w-12 md:h-12 shrink-0 rounded-full border border-neutral-300 dark:border-white/20 flex items-center justify-center group-hover:bg-neutral-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-black transition-all duration-300">
                                        <Play className="w-5 h-5 md:w-5 md:h-5 ml-1" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-light text-neutral-900 dark:text-white mb-1 group-hover:translate-x-2 transition-transform duration-300">
                                            {convo.title || 'Untitled Session'}
                                        </h3>
                                        <div className="flex items-center gap-3 text-[10px] md:text-xs text-neutral-500 tracking-widest uppercase">
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
                                        <div className="p-3 text-neutral-400 rounded-full">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenDropdownId(openDropdownId === convo.id ? null : convo.id);
                                            }}
                                            className="p-3 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-white/10"
                                        >
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    )}
                                    
                                    {openDropdownId === convo.id && !deletingId && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }} />
                                            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-white/10 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                {convo.audio_url && (
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
                                                                    // Optionally delete here too
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
                                                        className="w-full text-left px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center gap-3 transition-colors border-b border-neutral-100 dark:border-white/5"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Download Audio</span>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenDropdownId(null);
                                                        handleDeleteClick(e, convo.id);
                                                    }}
                                                    disabled={deletingId === convo.id}
                                                    className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                                >
                                                    {deletingId === convo.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                    <span className="text-sm font-medium">Delete Session</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Expanded View Modal */}
            {selectedConversation && (
                <ExpandedVoiceView 
                    conversation={selectedConversation} 
                    onClose={() => {
                        setSelectedConversation(null);
                        if (location.pathname.startsWith('/voice-history/')) {
                            navigate('/voice-history');
                        }
                    }}
                    userProfile={userProfile}
                    onNavigate={onNavigate}
                    onLogout={onLogout}
                    onOpenAuthModal={onOpenAuthModal}
                    onOpenProfileModal={onOpenProfileModal}
                    user={user}
                    onNotFound={(id) => {
                        // Automatically delete if audio is not found in Telegram
                        if (!isSuspended) {
                            deleteConversation(id, user).then(() => {
                                setConversations(prev => prev.filter(c => c.id !== id));
                            });
                        }
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Session"
                message="Are you sure you want to delete this voice session? This action cannot be undone."
                confirmButtonText="Delete Forever"
                confirmButtonVariant="danger"
            />
        </div>
    );
};

export default VoiceHistoryView;
