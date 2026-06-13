import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GalleryItem, UserProfile } from '../../types';
import { getGalleryItems, saveGalleryItem, deleteGalleryItem } from '../../services/dbService';
import { uploadFileToTelegram, getFileUrlFromTelegram, TELEGRAM_CHAT_ID, UploadMetadata } from '../../services/telegramStorage';
import { supabaseUrl } from '../../services/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Upload, X, Trash2, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Image as ImageIcon, LoaderCircle, ChevronLeft, ChevronRight, ArrowLeft, Share2, Download, CheckCircle2, Circle, Info, Check, FileText, Music, File, Grid, List, FileSpreadsheet, FileArchive, FileCode, FileAudio, FileVideo, FileImage, RotateCcw, RotateCw, ZoomIn, ZoomOut, HardDrive, FileType, Calendar, Copy, Sun, Moon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, isToday, isYesterday } from 'date-fns';
import { useToast } from '../ToastManager';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Custom hook to sync with app theme
const useAppTheme = () => {
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setIsDark(document.documentElement.classList.contains('dark'));
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    return isDark;
};

interface GalleryViewProps {
    user: User | null;
    userProfile?: UserProfile;
    setGalleryHeaderState: (state: { onUpload?: () => void; isUploading?: boolean }) => void;
    isSuspended?: boolean;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getDocumentConfig = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return { icon: FileText, color: 'text-red-500', bg: 'bg-red-500/10' };
    if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return { icon: FileSpreadsheet, color: 'text-green-500', bg: 'bg-green-500/10' };
    if (['ppt', 'pptx', 'odp'].includes(ext)) return { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-500/10' };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { icon: FileArchive, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (['json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'md', 'txt'].includes(ext)) return { icon: FileCode, color: 'text-purple-500', bg: 'bg-purple-500/10' };
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return { icon: FileAudio, color: 'text-pink-500', bg: 'bg-pink-500/10' };
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return { icon: FileVideo, color: 'text-indigo-500', bg: 'bg-indigo-500/10' };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { icon: FileImage, color: 'text-teal-500', bg: 'bg-teal-500/10' };
    return { icon: File, color: 'text-gray-500', bg: 'bg-gray-500/10' };
};

const SwipeZoomContainer: React.FC<{ 
    children: React.ReactNode, 
    onSwipeLeft: () => void, 
    onSwipeRight: () => void, 
    onClose: () => void,
    isZoomable: boolean,
    isSwipeable?: boolean
}> = ({ children, onSwipeLeft, onSwipeRight, onClose, isZoomable, isSwipeable = true }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let initialDistance: number | null = null;
        let initialScale = 1;
        let lastTouchCenter: {x: number, y: number} | null = null;
        let touchStart: {x: number, y: number} | null = null;
        let touchEnd: {x: number, y: number} | null = null;

        const getDistance = (touches: TouchList) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const getCenter = (touches: TouchList) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2,
            };
        };

        const shouldIgnoreSwipe = (e: TouchEvent) => {
            const target = e.target as HTMLElement;
            return target.tagName === 'INPUT' || target.tagName === 'BUTTON' || !!target.closest('.no-swipe');
        };

        const handleTouchStart = (e: TouchEvent) => {
            if (shouldIgnoreSwipe(e)) return;
            if (e.touches.length === 2 && isZoomable) {
                initialDistance = getDistance(e.touches);
                initialScale = scale;
                lastTouchCenter = getCenter(e.touches);
            } else if (e.touches.length === 1) {
                touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                lastTouchCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                touchEnd = null;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (shouldIgnoreSwipe(e)) return;
            if (e.touches.length === 2 && initialDistance !== null && isZoomable) {
                e.preventDefault();
                const currentDistance = getDistance(e.touches);
                const newScale = Math.max(1, Math.min(initialScale * (currentDistance / initialDistance), 5));
                setScale(newScale);

                const currentCenter = getCenter(e.touches);
                if (lastTouchCenter) {
                    const dx = currentCenter.x - lastTouchCenter.x;
                    const dy = currentCenter.y - lastTouchCenter.y;
                    setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                }
                lastTouchCenter = currentCenter;
            } else if (e.touches.length === 1 && scale > 1 && isZoomable) {
                e.preventDefault();
                const currentCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                if (lastTouchCenter) {
                    const dx = currentCenter.x - lastTouchCenter.x;
                    const dy = currentCenter.y - lastTouchCenter.y;
                    setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                }
                lastTouchCenter = currentCenter;
            } else if (e.touches.length === 1 && scale === 1) {
                touchEnd = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (shouldIgnoreSwipe(e)) return;
            if (e.touches.length < 2) {
                initialDistance = null;
            }
            if (e.touches.length === 0) {
                if (scale === 1 && touchStart && touchEnd && isSwipeable) {
                    const distanceX = touchStart.x - touchEnd.x;
                    const distanceY = touchStart.y - touchEnd.y;
                    if (Math.abs(distanceX) > Math.abs(distanceY) * 1.5 && Math.abs(distanceX) > 80) {
                        if (distanceX > 0) onSwipeLeft();
                        else onSwipeRight();
                    }
                }
                
                // Snap back to center if scale is 1
                setScale(prev => {
                    if (prev <= 1) {
                        setPosition({ x: 0, y: 0 });
                        return 1;
                    }
                    return prev;
                });
            }
        };

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        container.addEventListener('touchcancel', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            container.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [scale, onSwipeLeft, onSwipeRight, isZoomable, isSwipeable]);

    return (
        <div 
            ref={containerRef} 
            className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
            onClick={onClose}
        >
            <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: 'center'
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            >
                {children}
            </div>
        </div>
    );
};

const CustomVideoPlayer: React.FC<{ src: string, autoPlay?: boolean }> = ({ src, autoPlay = false }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (autoPlay && videoRef.current) {
            const playPromise = videoRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    setIsPlaying(false);
                });
            }
        }
    }, [autoPlay, src]);

    const togglePlay = (e?: React.MouseEvent) => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        setIsPlaying(false);
                    });
                }
                setIsPlaying(true);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = videoRef.current.currentTime;
            const total = videoRef.current.duration;
            setProgress((current / total) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) setDuration(videoRef.current.duration);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
            videoRef.current.currentTime = time;
            setProgress(parseFloat(e.target.value));
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    const formatTime = (time: number) => {
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div 
            className="relative w-full h-full flex items-center justify-center group bg-black"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowControls(false)}
            onClick={togglePlay}
        >
            <video 
                ref={videoRef}
                src={src} 
                className="max-w-full max-h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                playsInline
            />

            {/* Custom Controls Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 transition-opacity duration-500 flex flex-col justify-between p-4 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <div /> {/* Top spacer */}

                <div className="space-y-4 no-swipe" onClick={(e) => e.stopPropagation()}>
                    {/* Progress Bar */}
                    <div className="flex items-center gap-3 group/progress">
                        <span className="text-[10px] font-medium text-white/80 tabular-nums w-8">
                            {formatTime((progress / 100) * duration)}
                        </span>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={progress || 0} 
                            onChange={handleSeek}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            className="flex-1 h-1 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all"
                            style={{ 
                                background: `linear-gradient(to right, #6366f1 ${progress || 0}%, rgba(255,255,255,0.2) ${progress || 0}%)`,
                                WebkitAppearance: 'none'
                            }}
                        />
                        <span className="text-[10px] font-medium text-white/80 tabular-nums w-8">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                            </button>
                            <button onClick={toggleMute} className="text-white hover:scale-110 transition-transform">
                                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                        </div>
                        
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                if (videoRef.current?.requestFullscreen) videoRef.current.requestFullscreen();
                            }}
                            className="text-white hover:scale-110 transition-transform"
                        >
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Big Center Play Button (Visible when paused) */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 bg-black/20 rounded-full flex items-center justify-center border border-white/20 animate-in zoom-in-50 duration-300">
                        <Play className="w-8 h-8 text-white fill-current ml-1" />
                    </div>
                </div>
            )}
        </div>
    );
};

const TelegramMedia: React.FC<{ 
    item: GalleryItem, 
    className?: string, 
    onClick?: () => void,
    onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void,
    onPointerUp?: () => void,
    onPointerLeave?: () => void,
    onNotFound?: (id: string) => void,
    viewMode?: 'grid' | 'list'
}> = ({ item, className, onClick, onPointerDown, onPointerUp, onPointerLeave, onNotFound, viewMode = 'grid' }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [thumbUrl, setThumbUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [isTooLarge, setIsTooLarge] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds

        const fetchUrl = async () => {
            try {
                // Try to get main URL
                const resolvedUrl = await getFileUrlFromTelegram(item.url);
                
                if (isMounted) {
                    if (resolvedUrl === '__NOT_FOUND__') {
                        setIsError(true);
                        setLoading(false);
                        if (onNotFound) onNotFound(item.id);
                        return;
                    }
                    if (resolvedUrl === '__TOO_LARGE__') {
                        setIsTooLarge(true);
                        // If too large, try to get thumbnail at least
                        const resolvedThumb = await getFileUrlFromTelegram(item.url, true);
                        if (resolvedThumb) setThumbUrl(resolvedThumb);
                        setLoading(false);
                    } else if (resolvedUrl) {
                        setUrl(resolvedUrl);
                        setIsError(false);
                        setLoading(false);
                    } else if (retryCount < maxRetries) {
                        // Retry if it failed (Telegram might be slow)
                        retryCount++;
                        setTimeout(fetchUrl, retryDelay);
                    } else {
                        // If main URL fails after retries, try thumb as fallback for grid
                        const resolvedThumb = await getFileUrlFromTelegram(item.url, true);
                        if (resolvedThumb === '__NOT_FOUND__') {
                            setIsError(true);
                            if (onNotFound) onNotFound(item.id);
                        } else if (resolvedThumb) {
                            setThumbUrl(resolvedThumb);
                            setIsError(false);
                        } else {
                            setIsError(true);
                        }
                        setLoading(false);
                    }
                }
            } catch (e) {
                console.error("Failed to load media", e);
                if (isMounted) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(fetchUrl, retryDelay);
                    } else {
                        setIsError(true);
                        setLoading(false);
                    }
                }
            }
        };
        fetchUrl();
        return () => { isMounted = false; };
    }, [item.url, item.id, onNotFound]);

    if (loading || item.isPlaceholder) {
        return (
            <div 
                className={`bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center justify-center animate-pulse relative ${className}`} 
                onClick={onClick}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
            >
                {item.isPlaceholder && (
                    <>
                        <div className="relative w-12 h-12 flex items-center justify-center">
                            <LoaderCircle className="w-8 h-8 animate-spin text-indigo-500" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400">
                                    {Math.round(item.uploadProgress || 0)}%
                                </span>
                            </div>
                        </div>
                        <span className="text-[9px] text-neutral-500 dark:text-neutral-400 font-bold mt-2 uppercase tracking-tighter">
                            {item.type === 'video' ? 'Uploading Video...' : item.type === 'audio' ? 'Uploading Audio...' : item.type === 'document' ? 'Uploading Document...' : item.type === 'image' ? 'Uploading Image...' : 'Uploading File...'}
                        </span>
                        
                        {/* Progress bar for all files */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-800">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-300" 
                                style={{ width: `${item.uploadProgress || 0}%` }}
                            />
                        </div>
                    </>
                )}
            </div>
        );
    }

    if (isError || (!url && !thumbUrl && !isTooLarge)) {
        return (
            <div 
                className={`bg-neutral-50 dark:bg-neutral-900/50 flex flex-col items-center justify-center border border-dashed border-neutral-200 dark:border-neutral-800 ${className}`} 
                onClick={onClick}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
            >
                <ImageIcon className="w-6 h-6 text-neutral-300 dark:text-neutral-700 mb-1" />
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 font-medium">Missing</span>
            </div>
        );
    }

    if (viewMode === 'list') {
        const { icon: DocIcon, color, bg } = getDocumentConfig(item.filename);
        const Icon = item.type === 'audio' ? Music : item.type === 'video' ? Play : item.type === 'image' ? ImageIcon : DocIcon;
        const iconColor = item.type === 'document' || item.type === 'other' ? color : 'text-neutral-500';
        const iconBg = item.type === 'document' || item.type === 'other' ? bg : 'bg-neutral-200 dark:bg-neutral-700';

        const showThumb = item.type === 'image' || item.type === 'video' || (item.type === 'document' && thumbUrl);
        
        return (
            <div 
                className={`flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-all duration-200 shadow-sm hover:shadow-md ${className}`}
                onClick={onClick}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
            >
                <div className={`w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden relative shadow-inner ${!showThumb ? iconBg : 'bg-neutral-200 dark:bg-neutral-700'}`}>
                    {showThumb ? (
                        <>
                            {item.type === 'video' && url && !thumbUrl ? (
                                <video src={url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" preload="metadata" muted playsInline />
                            ) : (
                                <img src={thumbUrl || url || ''} alt="" className="w-full h-full object-cover" />
                            )}
                            {item.type === 'video' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-full">
                                        <Play className="w-3 h-3 text-white fill-current" />
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <Icon className={`w-7 h-7 ${!showThumb && (item.type === 'document' || item.type === 'other') ? iconColor : 'text-neutral-500'}`} />
                    )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 truncate mb-1">{item.filename}</h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                        <span className="uppercase tracking-wider px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md">{item.type}</span>
                        <span>•</span>
                        <span>{formatBytes(item.size)}</span>
                    </div>
                </div>
            </div>
        );
    }

    if (item.type === 'document' || item.type === 'audio' || item.type === 'other') {
        if (item.type === 'document' && thumbUrl) {
            return (
                <div 
                    className={`relative group overflow-hidden bg-white dark:bg-neutral-800 ${className}`} 
                    onClick={onClick}
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerLeave}
                >
                    <img 
                        src={thumbUrl} 
                        alt={item.filename} 
                        className="w-full h-full object-cover transition-transform duration-300 pointer-events-none" 
                        loading="lazy" 
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-2 left-2 right-10 text-[10px] text-white font-medium truncate pointer-events-none">
                        {item.filename}
                    </span>
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/40 backdrop-blur-md rounded text-[9px] font-bold text-white flex items-center gap-1 pointer-events-none select-none uppercase">
                        PDF
                    </div>
                </div>
            );
        }

        const { icon: DocIcon, color, bg } = getDocumentConfig(item.filename);
        const Icon = item.type === 'audio' ? Music : DocIcon;
        const iconColor = item.type === 'audio' ? 'text-neutral-400 dark:text-neutral-500' : color;
        const containerBg = item.type === 'audio' ? 'bg-neutral-100 dark:bg-neutral-800' : bg;

        return (
            <div 
                className={`${containerBg} flex flex-col items-center justify-center border border-neutral-200/50 dark:border-neutral-700/50 h-full w-full ${className}`} 
                onClick={onClick}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
            >
                <Icon className={`w-8 h-8 mb-2 ${iconColor}`} />
                <span className="text-[10px] text-neutral-600 dark:text-neutral-300 font-medium truncate w-full px-2 text-center">
                    {item.filename}
                </span>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/40 backdrop-blur-md rounded text-[9px] font-bold text-white flex items-center gap-1 pointer-events-none select-none uppercase">
                    {item.type}
                </div>
            </div>
        );
    }

    if (item.type === 'video') {
        const displayUrl = url || thumbUrl;
        return (
            <div 
                className={`relative bg-black group shadow-sm overflow-hidden ${className}`} 
                onClick={onClick}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
                onMouseEnter={(e) => {
                    if (!url) return; // Can't play if only thumb is available
                    const video = e.currentTarget.querySelector('video');
                    if (video) {
                        video.play().catch(() => {});
                    }
                }}
                onMouseLeave={(e) => {
                    const video = e.currentTarget.querySelector('video');
                    if (video) {
                        video.pause();
                        video.currentTime = 0;
                    }
                }}
            >
                {url ? (
                    <video 
                        src={url} 
                        poster={thumbUrl || undefined}
                        className="w-full h-full object-cover transition-transform duration-700 pointer-events-none" 
                        preload="metadata" 
                        muted 
                        loop 
                        playsInline 
                    />
                ) : (
                    <img 
                        src={thumbUrl || ''} 
                        className="w-full h-full object-cover" 
                        alt="Video Thumbnail"
                    />
                )}
                
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors pointer-events-none">
                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30 transform transition-transform duration-500">
                        {isTooLarge ? <Info className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white fill-current" />}
                    </div>
                </div>
                
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-bold text-white flex items-center gap-1 pointer-events-none select-none">
                    {isTooLarge ? 'LARGE' : 'VIDEO'}
                </div>
            </div>
        );
    }

    return (
        <div 
            className={`relative group overflow-hidden ${className}`} 
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
        >
            <img 
                src={url || thumbUrl || ''} 
                alt={item.filename} 
                className="w-full h-full object-cover transition-transform duration-300 pointer-events-none" 
                loading="lazy" 
                referrerPolicy="no-referrer"
            />
            {isTooLarge && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">LARGE</span>
                </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </div>
    );
};

// Simple module-level cache to prevent refetching on view toggle
let galleryCache: GalleryItem[] | null = null;
let lastUserId: string | null = null;

const UnsupportedViewer: React.FC<{ url: string, filename: string }> = ({ url, filename }) => {
    const isDarkMode = useAppTheme();
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    return (
        <div className="w-full h-full bg-black flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden relative">
            <div className={`flex-1 w-full h-full p-6 sm:p-12 flex flex-col items-center justify-center transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}>
                <div className={`flex flex-col items-center justify-center p-8 rounded-2xl max-w-sm w-full text-center ${isDarkMode ? 'bg-neutral-800 border border-white/10' : 'bg-white border border-neutral-200'} shadow-xl`}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-indigo-500/10 text-indigo-500">
                        <FileText className="w-8 h-8" />
                    </div>
                    <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
                        Preview not available
                    </h3>
                    <p className={`text-sm mb-8 ${isDarkMode ? 'text-white/60' : 'text-neutral-500'}`}>
                        Files of type <strong>.{ext}</strong> cannot be previewed in the browser. Please download the file to view its contents.
                    </p>
                    <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-3 px-4 rounded-xl font-medium transition-all hover:scale-[1.02] active:scale-95"
                    >
                        <Download className="w-5 h-5" />
                        Download File
                    </a>
                </div>
            </div>

            {/* Fixed Footer Toolbar */}
            <div className="w-full h-14 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs sm:text-sm font-medium truncate max-w-[150px] sm:max-w-[300px]">{filename}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </a>
                </div>
            </div>
        </div>
    );
};

const OfficeViewer: React.FC<{ url: string, filename: string }> = ({ url, filename }) => {
    const [useGoogle, setUseGoogle] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const { addToast } = useToast();
    const toastShownRef = useRef(false);
    const isDarkMode = useAppTheme();
    
    useEffect(() => {
        if (useGoogle || toastShownRef.current) return;
        
        // Show fallback toast after 8 seconds just in case it's stuck internally
        const timer = setTimeout(() => {
            if (!toastShownRef.current) {
                toastShownRef.current = true;
                addToast('Document taking too long?', 'warning', {
                    label: 'Try Google Viewer',
                    onClick: () => setUseGoogle(true)
                });
            }
        }, 8000);
        
        return () => clearTimeout(timer);
    }, [useGoogle, addToast]);
    
    const msUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    
    return (
        <div className="w-full h-full bg-black flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden relative">
            <div className={`flex-1 w-full h-full overflow-hidden bg-black relative px-[2px] pb-[2px] pt-4`}>
                {!isLoaded && !useGoogle && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 z-10">
                        <LoaderCircle className="w-8 h-8 animate-spin text-white/50 mb-4" />
                        <p className="text-white/50 text-sm">Loading document...</p>
                    </div>
                )}
                <iframe 
                    key={useGoogle ? 'google' : 'ms'}
                    src={useGoogle ? googleUrl : msUrl} 
                    className={`w-full h-full border-0 bg-white outline-none focus:outline-none ${!isLoaded && !useGoogle ? 'opacity-0' : 'opacity-100'} transition-all duration-300 ${isDarkMode ? 'invert hue-rotate-180 brightness-90 contrast-125' : ''}`}
                    title={filename}
                    onLoad={() => setIsLoaded(true)}
                />
            </div>
            
            {/* Fixed Footer Toolbar */}
            <div className="w-full h-14 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs sm:text-sm font-medium truncate max-w-[150px] sm:max-w-[300px]">{filename}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </a>
                </div>
            </div>
        </div>
    );
};

const TextViewer: React.FC<{ url: string, filename: string }> = ({ url, filename }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isDarkMode = useAppTheme();

    useEffect(() => {
        const fetchText = async () => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Failed to fetch file directly');
                const text = await response.text();
                setContent(text);
            } catch (err) {
                try {
                    // Fallback to proxy if direct fetch fails (e.g. CORS)
                    const PROXY_URL = `/api/image-proxy?url=${encodeURIComponent(url)}`;
                    const proxyResponse = await fetch(PROXY_URL);
                    if (!proxyResponse.ok) throw new Error('Failed to fetch file via proxy');
                    const data = await proxyResponse.json();
                    if (data.error) throw new Error(data.error);
                    
                    const base64Content = data.dataUrl.split(',')[1];
                    const binaryString = window.atob(base64Content);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const text = new TextDecoder('utf-8').decode(bytes);
                    setContent(text);
                } catch (proxyErr) {
                    setError(proxyErr instanceof Error ? proxyErr.message : 'Unknown error');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchText();
    }, [url]);

    return (
        <div className="w-full h-full bg-black flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden relative">
            <div className={`flex-1 w-full h-full overflow-auto p-2 sm:p-4 md:p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-neutral-100'}`}>
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <LoaderCircle className="w-8 h-8 animate-spin text-indigo-500" />
                        <span className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-neutral-500'}`}>Loading text...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-red-500">
                        <Info className="w-8 h-8" />
                        <span className="text-sm">Failed to load text: {error}</span>
                    </div>
                ) : (
                    <pre className={`font-mono text-xs sm:text-sm whitespace-pre-wrap break-words w-full max-w-4xl mx-auto p-4 sm:p-6 rounded-xl shadow-2xl overflow-x-auto outline-none focus:outline-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-white/90 border border-white/10' : 'bg-white text-neutral-900 border border-neutral-200'}`}>
                        {content}
                    </pre>
                )}
            </div>

            {/* Fixed Footer Toolbar */}
            <div className="w-full h-14 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs sm:text-sm font-medium truncate max-w-[150px] sm:max-w-[300px]">{filename}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </a>
                </div>
            </div>
        </div>
    );
};

const PdfViewer: React.FC<{ url: string, filename: string }> = ({ url, filename }) => {
    const [numPages, setNumPages] = useState<number>();
    const [scale, setScale] = useState<number>(1.0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>();
    const [pdfData, setPdfData] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const isDarkMode = useAppTheme();

    useEffect(() => {
        const fetchPdf = async () => {
            try {
                const PROXY_URL = `/api/image-proxy?url=${encodeURIComponent(url)}`;
                const response = await fetch(PROXY_URL);
                if (!response.ok) throw new Error('Failed to fetch PDF');
                const data = await response.json();
                if (data.error) throw new Error(data.error);
                setPdfData(data.dataUrl);
            } catch (err) {
                console.error('Error fetching PDF:', err);
                setFetchError(err instanceof Error ? err.message : 'Unknown error');
            }
        };
        fetchPdf();
    }, [url]);

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const zoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.min(prev + 0.2, 3.0));
    };

    const zoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.max(prev - 0.2, 0.5));
    };

    return (
        <div className="w-full h-full bg-black flex flex-col items-center animate-in zoom-in-95 duration-500 overflow-hidden relative">
            <style>{`
                .react-pdf__Page, .react-pdf__Page canvas, .react-pdf__Document {
                    outline: none !important;
                    -webkit-tap-highlight-color: transparent;
                }
            `}</style>
            {/* Document Container */}
            <div ref={containerRef} className="flex-1 w-full h-full overflow-auto relative z-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="min-h-full min-w-full w-fit flex flex-col items-center px-[2px] pb-4">
                    {fetchError ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-red-400 w-full min-h-[50vh]">
                            <Info className="w-8 h-8" />
                            <span className="text-sm">Failed to load PDF: {fetchError}</span>
                        </div>
                    ) : !pdfData ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full min-h-[50vh]">
                            <LoaderCircle className="w-8 h-8 animate-spin text-indigo-500" />
                            <span className="text-white/60 text-sm">Downloading PDF...</span>
                        </div>
                    ) : (
                        <div className={`min-w-full w-fit flex flex-col items-center transition-all duration-300 outline-none focus:outline-none ${isDarkMode ? 'invert hue-rotate-180 brightness-90 contrast-125' : ''}`}>
                            <Document
                                file={pdfData}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 w-full h-full">
                                        <LoaderCircle className="w-8 h-8 animate-spin text-indigo-500" />
                                        <span className="text-white/60 text-sm">Rendering PDF...</span>
                                    </div>
                                }
                                error={
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-red-400 w-full h-full">
                                        <Info className="w-8 h-8" />
                                        <span className="text-sm">Failed to render PDF. It might be corrupted.</span>
                                    </div>
                                }
                                className={`flex flex-col gap-4 items-center min-w-full w-fit outline-none focus:outline-none ${numPages === 1 ? 'm-auto' : ''}`}
                            >
                                {Array.from(new Array(numPages || 0), (el, index) => (
                                    <Page 
                                        key={`page_${index + 1}`}
                                        pageNumber={index + 1} 
                                        scale={scale} 
                                        width={containerWidth ? Math.min(containerWidth - 4, 1200) : undefined}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        className="shadow-2xl bg-white shrink-0 outline-none focus:outline-none"
                                        loading={
                                            <div className="flex items-center justify-center w-full max-w-[800px] aspect-[1/1.4] bg-white/5 shrink-0">
                                                <LoaderCircle className="w-8 h-8 animate-spin text-indigo-500" />
                                            </div>
                                        }
                                    />
                                ))}
                            </Document>
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed Footer Toolbar */}
            <div className="w-full h-14 bg-neutral-900 border-t border-white/10 flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
                <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs sm:text-sm font-medium truncate max-w-[150px] sm:max-w-[300px]">{filename}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={() => setScale(1.0)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs sm:text-sm font-medium hidden sm:block" title="Actual Size">
                        100%
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1 hidden sm:block"></div>
                    <button onClick={zoomOut} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Zoom Out">
                        <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <span className="text-white/80 text-xs sm:text-sm font-medium w-10 sm:w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={zoomIn} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Zoom In">
                        <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="w-px h-4 bg-white/10 mx-1"></div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </a>
                </div>
            </div>
        </div>
    );
};

const CustomAudioPlayer: React.FC<{ src: string, autoPlay?: boolean, filename?: string }> = ({ src, autoPlay, filename }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(autoPlay || false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (autoPlay && audioRef.current) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    setIsPlaying(false);
                });
            }
        }
    }, [autoPlay, src]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        setIsPlaying(false);
                    });
                }
                setIsPlaying(true);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const seekTime = (percentage / 100) * duration;
        if (audioRef.current) {
            audioRef.current.currentTime = seekTime;
            setProgress(percentage);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const skipForward = () => {
        if (audioRef.current) audioRef.current.currentTime += 10;
    };

    const skipBackward = () => {
        if (audioRef.current) audioRef.current.currentTime -= 10;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-neutral-900 to-black animate-in zoom-in-95 duration-500 relative overflow-hidden">
            {/* Atmospheric background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[60vw] h-[60vw] rounded-full bg-indigo-500/10 blur-[120px] transition-all duration-1000 ${isPlaying ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
            </div>

            <div className="flex-1 flex items-center justify-center w-full max-w-2xl z-10 pointer-events-none">
                <div className="w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-full flex items-center justify-center relative shadow-[0_0_100px_rgba(99,102,241,0.1)]">
                    <div className={`absolute inset-0 border border-indigo-500/30 rounded-full ${isPlaying ? 'animate-ping opacity-50 duration-1000' : 'opacity-0'}`}></div>
                    <div className={`absolute inset-4 border-2 border-indigo-500/20 rounded-full ${isPlaying ? 'animate-ping opacity-30 duration-1000 delay-150' : 'opacity-0'}`}></div>
                    <Music className="w-20 h-20 sm:w-24 sm:h-24 text-indigo-400 drop-shadow-lg" />
                </div>
            </div>
            
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate} 
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            <div className="w-full max-w-2xl space-y-8 pb-12 sm:pb-20 z-10 no-swipe" onClick={(e) => e.stopPropagation()}>
                {filename && (
                    <div className="text-center px-4">
                        <h3 className="text-white text-xl sm:text-2xl font-bold truncate drop-shadow-md">{filename}</h3>
                        <p className="text-neutral-400 text-sm mt-2 uppercase tracking-widest">Audio File</p>
                    </div>
                )}

                {/* Progress Bar */}
                <div className="space-y-3 px-4 sm:px-8">
                    <div 
                        className="w-full h-2 bg-neutral-800 rounded-full cursor-pointer relative group no-swipe"
                        onClick={handleSeek}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                    >
                        <div 
                            className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full pointer-events-none transition-all duration-100 ease-linear" 
                            style={{ width: `${progress}%` }}
                        ></div>
                        <div 
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" 
                            style={{ left: `calc(${progress}% - 8px)` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-sm text-neutral-400 font-medium">
                        <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8 sm:gap-12">
                    <button onClick={skipBackward} className="p-3 text-neutral-400 hover:text-white transition-colors hover:scale-110 active:scale-95">
                        <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8" />
                    </button>

                    <button 
                        onClick={togglePlay}
                        className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-95"
                    >
                        {isPlaying ? <Pause className="w-10 h-10 sm:w-12 sm:h-12 fill-current" /> : <Play className="w-10 h-10 sm:w-12 sm:h-12 fill-current ml-2" />}
                    </button>

                    <button onClick={skipForward} className="p-3 text-neutral-400 hover:text-white transition-colors hover:scale-110 active:scale-95">
                        <RotateCw className="w-6 h-6 sm:w-8 sm:h-8" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const GalleryView: React.FC<GalleryViewProps> = ({ user, userProfile, setGalleryHeaderState, isSuspended }) => {
    const [items, setItems] = useState<GalleryItem[]>(galleryCache && lastUserId === user?.id ? galleryCache : []);
    const [loading, setLoading] = useState(!galleryCache || lastUserId !== user?.id);
    const [uploading, setUploading] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    const [fullScreenUrl, setFullScreenUrl] = useState<string | null>(null);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'images' | 'videos' | 'documents' | 'audio'>('all');
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showControls, setShowControls] = useState(true);

    const isSelectionMode = selectedIds.size > 0;

    const isDraggingRef = useRef(false);
    const dragModeRef = useRef<'add' | 'remove'>('add');
    const lastToggledIdRef = useRef<string | null>(null);
    const ignoreNextClickRef = useRef(false);

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent | TouchEvent) => {
            if (!isDraggingRef.current) return;
            
            if (e.cancelable) {
                e.preventDefault();
            }

            let clientX, clientY;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = (e as PointerEvent).clientX;
                clientY = (e as PointerEvent).clientY;
            }

            const el = document.elementFromPoint(clientX, clientY);
            const itemEl = el?.closest('[data-gallery-item-id]');
            if (itemEl) {
                const id = itemEl.getAttribute('data-gallery-item-id');
                if (id && id !== lastToggledIdRef.current) {
                    lastToggledIdRef.current = id;
                    setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (dragModeRef.current === 'add') {
                            next.add(id);
                        } else {
                            next.delete(id);
                        }
                        return next;
                    });
                    if (window.navigator.vibrate) {
                        window.navigator.vibrate([10]);
                    }
                }
            }
        };

        const handleGlobalPointerUp = () => {
            isDraggingRef.current = false;
            lastToggledIdRef.current = null;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
            }
        };

        document.addEventListener('touchmove', handlePointerMove, { passive: false });
        document.addEventListener('pointermove', handlePointerMove, { passive: false });
        document.addEventListener('touchend', handleGlobalPointerUp);
        document.addEventListener('pointerup', handleGlobalPointerUp);
        document.addEventListener('pointercancel', handleGlobalPointerUp);

        return () => {
            document.removeEventListener('touchmove', handlePointerMove);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('touchend', handleGlobalPointerUp);
            document.removeEventListener('pointerup', handleGlobalPointerUp);
            document.removeEventListener('pointercancel', handleGlobalPointerUp);
        };
    }, []);

    const handleItemClick = (item: GalleryItem) => {
        if (ignoreNextClickRef.current) {
            ignoreNextClickRef.current = false;
            return;
        }
        if (isLongPress.current) {
            isLongPress.current = false;
            return;
        }
        if (isSelectionMode) {
            return;
        }
        navigate(`/gallery/${item.id}`);
    };

    const handlePointerDown = (id: string, e: React.PointerEvent) => {
        isLongPress.current = false;
        
        if (selectedIds.size > 0) {
            ignoreNextClickRef.current = true;
            isDraggingRef.current = true;
            const isCurrentlySelected = selectedIds.has(id);
            dragModeRef.current = isCurrentlySelected ? 'remove' : 'add';
            lastToggledIdRef.current = id;
            
            setSelectedIds(prev => {
                const next = new Set(prev);
                if (isCurrentlySelected) next.delete(id);
                else next.add(id);
                return next;
            });
        } else {
            longPressTimer.current = setTimeout(() => {
                isLongPress.current = true;
                ignoreNextClickRef.current = true;
                isDraggingRef.current = true;
                dragModeRef.current = 'add';
                lastToggledIdRef.current = id;
                
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                });
                
                if (window.navigator.vibrate) {
                    window.navigator.vibrate([40]);
                }
            }, 400);
        }
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    const handleDeleteSelected = async () => {
        if (isSuspended) {
            alert("Delete blocked: Account suspended.");
            return;
        }
        if (selectedIds.size === 0) return;
        
        setIsDeletingMultiple(true);
        try {
            const idsToDelete = Array.from(selectedIds);
            await Promise.all(idsToDelete.map(id => deleteGalleryItem(id, user)));
            setItems(prev => {
                const next = prev.filter(item => !selectedIds.has(item.id));
                galleryCache = next;
                return next;
            });
            setSelectedIds(new Set());
            setShowMultiDeleteConfirm(false);
        } catch (err) {
            console.error("Multiple delete failed", err);
            alert("Failed to delete some items.");
        } finally {
            setIsDeletingMultiple(false);
        }
    };

    const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);
    const isLongPress = useRef(false);

    const loadItems = React.useCallback(async () => {
        // Only use cache if it belongs to the current user
        if (galleryCache && lastUserId === user?.id) {
            setItems(prev => {
                const placeholders = prev.filter(item => item.isPlaceholder);
                // Avoid duplicating items if they are already in cache
                const cacheWithoutPlaceholders = galleryCache!.filter(c => !placeholders.some(p => p.id === c.id));
                return [...placeholders, ...cacheWithoutPlaceholders];
            });
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const fetchedItems = await getGalleryItems(user);
            setItems(prev => {
                const placeholders = prev.filter(item => item.isPlaceholder);
                return [...placeholders, ...fetchedItems];
            });
            // Update cache after successful fetch
            galleryCache = fetchedItems;
            lastUserId = user?.id || null;
        } catch (error) {
            console.error("Failed to load gallery items:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Removed the aggressive useEffect that was poisoning the cache on user change

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const handleUploadTrigger = useCallback(() => {
        if (isSuspended) {
            alert("Upload blocked: Account suspended.");
            return;
        }
        // Use a small timeout to ensure the click is handled correctly on mobile
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 10);
    }, []);

    useEffect(() => {
        setGalleryHeaderState({
            onUpload: handleUploadTrigger,
            isUploading: uploading
        });
        return () => setGalleryHeaderState({});
    }, [uploading, setGalleryHeaderState, handleUploadTrigger]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSuspended) {
            alert("Upload blocked: Account suspended.");
            return;
        }
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files);
        if (newFiles.length === 0) return;

        const MAX_TELEGRAM_SIZE = 20 * 1024 * 1024; // 20MB
        const oversizedFiles = newFiles.filter(f => f.size > MAX_TELEGRAM_SIZE);
        
        if (oversizedFiles.length > 0) {
            const confirmUpload = window.confirm(
                `Some files are larger than 20MB. \n\nTelegram Bot API has a 20MB download limit. These files will be uploaded, but you might not be able to play/view them directly in this gallery. \n\nDo you want to continue?`
            );
            if (!confirmUpload) return;
        }

        setUploading(true);
        
        // Create placeholders
        const placeholders: GalleryItem[] = newFiles.map(file => {
            let fileType: GalleryItem['type'] = 'other';
            if (file.type.startsWith('image/')) fileType = 'image';
            else if (file.type.startsWith('video/')) fileType = 'video';
            else if (file.type.startsWith('audio/')) fileType = 'audio';
            else if (file.type.startsWith('text/') || file.type.includes('pdf') || file.type.includes('document') || file.type.includes('msword') || file.type.includes('excel') || file.type.includes('powerpoint') || file.type.includes('csv')) fileType = 'document';

            return {
                id: `temp-${uuidv4()}`,
                user_id: user?.id,
                url: '',
                type: fileType,
                mimeType: file.type,
                filename: file.name,
                size: file.size,
                createdAt: new Date().toISOString(),
                isPlaceholder: true,
                uploadProgress: 0
            };
        });

        setItems(prev => [...placeholders, ...prev]);

        try {
            for (let i = 0; i < newFiles.length; i++) {
                const file = newFiles[i];
                const placeholderId = placeholders[i].id;
                const fileType = placeholders[i].type;

                // Simulate progress
                const progressInterval = setInterval(() => {
                    setItems(prev => prev.map(item => {
                        if (item.id === placeholderId) {
                            const currentProgress = item.uploadProgress || 0;
                            const increment = Math.random() * 15;
                            const nextProgress = Math.min(currentProgress + increment, 90);
                            return { ...item, uploadProgress: nextProgress };
                        }
                        return item;
                    }));
                }, 500);

                try {
                    const metadata: UploadMetadata = {
                        userId: user?.id || 'N/A',
                        userName: userProfile?.full_name || userProfile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Unknown User',
                        userEmail: user?.email || 'N/A',
                        uploadedAt: new Date().toISOString(),
                        fileType: fileType.toUpperCase(),
                        mimeType: file.type || 'N/A',
                        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB (${file.size.toLocaleString()} bytes)`
                    };

                    const tgUrl = await uploadFileToTelegram(file, file.name, metadata);
                    clearInterval(progressInterval);

                    const newItem: GalleryItem = {
                        id: uuidv4(),
                        user_id: user?.id,
                        url: tgUrl,
                        type: fileType,
                        mimeType: file.type,
                        filename: file.name,
                        size: file.size,
                        createdAt: new Date().toISOString(),
                    };

                    await saveGalleryItem(newItem, user);
                    
                    // Replace placeholder with real item and update cache
                    setItems(prev => {
                        const next = prev.map(item => item.id === placeholderId ? newItem : item);
                        galleryCache = next;
                        return next;
                    });
                } catch (err) {
                    clearInterval(progressInterval);
                    console.error(`Failed to upload ${file.name}`, err);
                    // Remove placeholder on failure
                    setItems(prev => prev.filter(item => item.id !== placeholderId));
                }
            }
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string) => {
        if (isSuspended) {
            alert("Delete blocked: Account suspended.");
            return;
        }
        setDeleting(true);
        try {
            await deleteGalleryItem(id, user);
            setItems(prev => {
                const next = prev.filter(item => item.id !== id);
                galleryCache = next;
                return next;
            });
            if (selectedItem?.id === id) {
                setSelectedItem(null);
                setFullScreenUrl(null);
                navigate('/gallery', { replace: true });
            }
            setItemToDelete(null);
        } catch (err) {
            console.error("Delete failed", err);
            alert("Failed to delete item.");
        } finally {
            setDeleting(false);
        }
    };

    const [isDeleting, setDeleting] = useState(false);

    // Kept here for convenience, but the actual resolving happens in useEffect below
    const openFullScreen = async (item: GalleryItem) => {
        setSelectedItem(item);
        setFullScreenUrl(null);
        try {
            const url = await getFileUrlFromTelegram(item.url);
            if (url === '__NOT_FOUND__') {
                alert('File not found. It might have been deleted from Telegram.');
                setFullScreenUrl('error');
                // Automatically delete if not suspended
                if (!isSuspended) {
                    deleteGalleryItem(item.id, user).then(() => {
                        setItems(prev => prev.filter(i => i.id !== item.id));
                        galleryCache = galleryCache?.filter(i => i.id !== item.id) || null;
                        setSelectedItem(null);
                        navigate('/gallery', { replace: true });
                    });
                }
            } else if (url) {
                setFullScreenUrl(url);
            } else {
                setFullScreenUrl('error');
            }
        } catch (e) {
            console.error("Failed to resolve full screen url", e);
            setFullScreenUrl('error');
        }
    };

    useEffect(() => {
        const parts = location.pathname.split('/');
        const urlId = parts.length >= 3 && parts[1] === 'gallery' ? parts[2] : null;

        if (urlId && items.length > 0) {
            const item = items.find(i => i.id === urlId);
            if (item && selectedItem?.id !== urlId) {
                openFullScreen(item);
            }
        } else if (!urlId && selectedItem) {
             setSelectedItem(null);
             setFullScreenUrl(null);
        }
    }, [location.pathname, items]);

    const filteredItems = useMemo(() => {
        if (activeTab === 'images') return items.filter(i => i.type === 'image');
        if (activeTab === 'videos') return items.filter(i => i.type === 'video');
        if (activeTab === 'documents') return items.filter(i => i.type === 'document');
        if (activeTab === 'audio') return items.filter(i => i.type === 'audio');
        return items;
    }, [items, activeTab]);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!selectedItem) return;
        const currentIndex = filteredItems.findIndex(i => i.id === selectedItem.id);
        if (currentIndex < filteredItems.length - 1) {
            navigate(`/gallery/${filteredItems[currentIndex + 1].id}`);
        }
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!selectedItem) return;
        const currentIndex = filteredItems.findIndex(i => i.id === selectedItem.id);
        if (currentIndex > 0) {
            navigate(`/gallery/${filteredItems[currentIndex - 1].id}`);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedItem) return;
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') {
                navigate('/gallery');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, filteredItems]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, GalleryItem[]> = {};
        filteredItems.forEach(item => {
            const date = new Date(item.createdAt);
            let dateStr = format(date, 'MMM d, yyyy');
            if (isToday(date)) dateStr = 'Today';
            else if (isYesterday(date)) dateStr = 'Yesterday';
            
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(item);
        });
        return groups;
    }, [filteredItems]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                multiple 
                accept="*"
            />

            <div className="flex-1 overflow-y-auto py-4">
                <div className="h-20 flex-shrink-0"></div>
                
                <div className="mb-6 px-2 sm:px-4 flex justify-between items-center">
                    <div className="overflow-x-auto no-scrollbar">
                        <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl w-fit min-w-max">
                            {(['all', 'images', 'videos', 'documents', 'audio'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                                        activeTab === tab 
                                            ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl ml-2 flex-shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-8 px-2 sm:px-4">
                        {[1, 2].map((group) => (
                            <div key={group}>
                                <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-md animate-pulse mb-4"></div>
                                <div className={viewMode === 'grid' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-2 lg:gap-3" : "flex flex-col gap-3"}>
                                    {[1, 2, 3, 4, 5, 6].map((item) => (
                                        <div key={item} className={`${viewMode === 'grid' ? 'aspect-square rounded-lg sm:rounded-2xl' : 'h-20 rounded-2xl'} bg-neutral-200 dark:bg-neutral-800 animate-pulse shadow-sm`}></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                        <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg">No photos or videos yet</p>
                        <p className="text-sm">Upload some memories to get started</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedItems).map(([date, dateItems]) => (
                            <div key={date}>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-4 py-2 px-2 sm:px-4">
                                    {date}
                                </h2>
                                <div className={viewMode === 'grid' ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1 sm:gap-2 lg:gap-3 px-2 sm:px-4" : "flex flex-col gap-3 px-2 sm:px-4"}>
                                    {dateItems.map(item => (
                                        <div 
                                            key={item.id} 
                                            data-gallery-item-id={item.id}
                                            className={`${viewMode === 'grid' ? 'aspect-square rounded-lg sm:rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] z-0 hover:z-10' : 'rounded-2xl'} relative group cursor-pointer overflow-hidden bg-neutral-100 dark:bg-neutral-900 transition-all duration-300 ease-out select-none`}
                                            onClick={() => handleItemClick(item)}
                                            onPointerDown={(e) => handlePointerDown(item.id, e)}
                                            onPointerUp={handlePointerUp}
                                            onPointerLeave={handlePointerUp}
                                        >
                                            <TelegramMedia 
                                                item={item} 
                                                viewMode={viewMode}
                                                className={`${viewMode === 'grid' ? 'w-full h-full' : ''} transition-all duration-300 ${selectedIds.has(item.id) ? 'opacity-80' : ''}`}
                                                onNotFound={(id) => {
                                                    // Automatically delete items that are no longer in Telegram
                                                    deleteGalleryItem(id, user).then(() => {
                                                        setItems(prev => prev.filter(i => i.id !== id));
                                                        galleryCache = galleryCache?.filter(i => i.id !== id) || null;
                                                    });
                                                }}
                                            />
                                            
                                            {isSelectionMode && (
                                                <div className="absolute inset-0 bg-black/10 pointer-events-none transition-all duration-300">
                                                    <div className="absolute top-2 right-2 z-30">
                                                        {selectedIds.has(item.id) ? (
                                                            <div className="bg-indigo-500 rounded-full shadow-sm">
                                                                <CheckCircle2 className="w-6 h-6 text-white" fill="#6366f1" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full border-2 border-white/80 bg-black/20 backdrop-blur-sm" />
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Full Screen Viewer */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
                    {/* Top Bar */}
                    <div className="flex-none p-4 flex items-center justify-between z-20 bg-black/80 backdrop-blur-md border-b border-white/10 cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowControls(prev => !prev); }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); navigate('/gallery'); }}
                            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-lg"
                        >
                            <ArrowLeft className="w-6 h-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                        </button>
                        
                        <div className="flex-1 px-4 truncate text-center">
                            <span className="text-white font-medium text-sm sm:text-base drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                                {selectedItem.filename}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {fullScreenUrl && fullScreenUrl !== 'error' && (
                                <>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowInfoModal(true);
                                        }}
                                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-lg"
                                        title="Info"
                                    >
                                        <Info className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (navigator.share) {
                                                navigator.share({
                                                    title: selectedItem.filename,
                                                    url: fullScreenUrl
                                                }).catch(console.error);
                                            } else {
                                                navigator.clipboard.writeText(fullScreenUrl);
                                                alert("Link copied to clipboard!");
                                            }
                                        }}
                                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-lg"
                                        title="Share"
                                    >
                                        <Share2 className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                                    </button>
                                    <a 
                                        href={fullScreenUrl}
                                        download={selectedItem.filename}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-lg"
                                        title="Download"
                                    >
                                        <Download className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                                    </a>
                                </>
                            )}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setItemToDelete(selectedItem.id);
                                }}
                                className="p-2 text-white hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors drop-shadow-lg"
                                title="Delete"
                            >
                                <Trash2 className="w-5 h-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Main Content Area */}
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden" onClick={() => setShowControls(prev => !prev)}>
                        {/* Prev Button - Desktop & Mobile Side */}
                        {filteredItems.findIndex(i => i.id === selectedItem.id) > 0 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                className={`absolute left-2 sm:left-4 z-30 p-2 sm:p-3 text-white transition-all active:scale-90 drop-shadow-lg ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                            >
                                <ChevronLeft className="w-8 h-8 sm:w-10 h-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                            </button>
                        )}

                        {/* Media Container */}
                        <div className={`w-full h-full flex items-center justify-center z-10 ${selectedItem.type === 'document' && selectedItem.mimeType === 'application/pdf' ? 'p-0' : 'p-0 sm:p-12'}`} onClick={(e) => e.stopPropagation()}>
                            {!fullScreenUrl ? (
                                <div className="flex flex-col items-center gap-4">
                                    <LoaderCircle className="w-12 h-12 animate-spin text-white/40" />
                                    <p className="text-white/40 text-sm font-medium animate-pulse">Fetching from Telegram...</p>
                                </div>
                            ) : fullScreenUrl === 'error' || fullScreenUrl === '__TOO_LARGE__' ? (
                                <div className="flex flex-col items-center justify-center text-gray-400 animate-in zoom-in-95 duration-300 px-6">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                                        {fullScreenUrl === '__TOO_LARGE__' ? <Maximize className="w-10 h-10 opacity-30" /> : <ImageIcon className="w-10 h-10 opacity-30" />}
                                    </div>
                                    <p className="text-xl font-bold text-white">
                                        {fullScreenUrl === '__TOO_LARGE__' ? 'File too large' : 'Media not found'}
                                    </p>
                                    <p className="text-sm mt-2 text-gray-500 max-w-xs text-center">
                                        {fullScreenUrl === '__TOO_LARGE__' 
                                            ? 'This file is larger than 20MB. Telegram Bot API does not allow direct playback of large files. Please use the download button to view it.' 
                                            : 'This file might have been removed from Telegram or the link has expired.'}
                                    </p>
                                    {fullScreenUrl === '__TOO_LARGE__' && (
                                        <a 
                                            href={`https://t.me/c/${TELEGRAM_CHAT_ID.replace('-100', '')}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="mt-6 px-6 py-2 bg-indigo-500 text-white rounded-full font-bold text-sm"
                                        >
                                            View in Telegram
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <SwipeZoomContainer 
                                    onSwipeLeft={handleNext} 
                                    onSwipeRight={handlePrev} 
                                    onClose={() => setShowControls(prev => !prev)}
                                    isZoomable={selectedItem.type === 'image'}
                                    isSwipeable={selectedItem.type === 'image' || selectedItem.type === 'video' || selectedItem.type === 'audio'}
                                >
                                    {selectedItem.type === 'video' ? (
                                        <CustomVideoPlayer src={fullScreenUrl} autoPlay />
                                    ) : selectedItem.type === 'audio' ? (
                                        <CustomAudioPlayer src={fullScreenUrl} autoPlay filename={selectedItem.filename} />
                                    ) : selectedItem.type === 'document' || selectedItem.type === 'other' ? (
                                        (() => {
                                            const ext = selectedItem.filename.split('.').pop()?.toLowerCase() || '';
                                            const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];
                                            const unsupportedExts = ['odt', 'ods', 'odp', 'rtf', 'zip', 'rar', '7z', 'tar', 'gz', 'exe', 'bin', 'iso', 'dmg'];

                                            if (ext === 'pdf' || selectedItem.mimeType === 'application/pdf') {
                                                return <PdfViewer url={fullScreenUrl} filename={selectedItem.filename} />;
                                            } else if (officeExts.includes(ext)) {
                                                return <OfficeViewer url={fullScreenUrl} filename={selectedItem.filename} />;
                                            } else if (unsupportedExts.includes(ext)) {
                                                return <UnsupportedViewer url={fullScreenUrl} filename={selectedItem.filename} />;
                                            } else {
                                                // Fallback to text viewer instead of just download card
                                                return <TextViewer url={fullScreenUrl} filename={selectedItem.filename} />;
                                            }
                                        })()
                                    ) : (
                                        <img 
                                            src={fullScreenUrl} 
                                            alt={selectedItem.filename} 
                                            className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-500 pointer-events-none"
                                        />
                                    )}
                                </SwipeZoomContainer>
                            )}
                        </div>

                        {/* Next Button - Desktop & Mobile Side */}
                        {filteredItems.findIndex(i => i.id === selectedItem.id) < filteredItems.length - 1 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                className={`absolute right-2 sm:right-4 z-30 p-2 sm:p-3 text-white transition-all active:scale-90 drop-shadow-lg ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                            >
                                <ChevronRight className="w-8 h-8 sm:w-10 h-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                            </button>
                        )}
                    </div>
                    
                    {/* Bottom Bar for Mobile Controls - Removed as buttons moved to sides */}
                </div>
            )}

            {/* Multi-select Header */}
            {isSelectionMode && (
                <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-sm animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setSelectedIds(new Set())}
                            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {selectedIds.size} selected
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => {
                                if (selectedIds.size === filteredItems.length) {
                                    setSelectedIds(new Set());
                                } else {
                                    setSelectedIds(new Set(filteredItems.map(i => i.id)));
                                }
                            }}
                            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                            {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <button 
                            onClick={() => setShowMultiDeleteConfirm(true)}
                            disabled={isDeletingMultiple}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors disabled:opacity-50"
                        >
                            {isDeletingMultiple ? (
                                <LoaderCircle className="w-5 h-5 animate-spin" />
                            ) : (
                                <Trash2 className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Multi-delete Confirmation Modal */}
            {showMultiDeleteConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete {selectedIds.size} Items?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">This will permanently remove all selected items from your gallery and Telegram.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowMultiDeleteConfirm(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                disabled={isDeletingMultiple}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteSelected}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                disabled={isDeletingMultiple}
                            >
                                {isDeletingMultiple ? (
                                    <LoaderCircle className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Item?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">This will permanently remove the item from your gallery and Telegram.</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setItemToDelete(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleDelete(itemToDelete)}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                                disabled={isDeleting}
                            >
                                {isDeleting ? (
                                    <LoaderCircle className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Modal */}
            {showInfoModal && selectedItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowInfoModal(false)}>
                    <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 border border-neutral-200/50 dark:border-neutral-800/50" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">File Details</h3>
                            </div>
                            <button onClick={() => setShowInfoModal(false)} className="p-2 rounded-full hover:bg-neutral-100 dark:bg-neutral-800 text-neutral-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                                <div className="flex items-start gap-3">
                                    <FileText className="w-5 h-5 text-neutral-400 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Filename</p>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white break-all">{selectedItem.filename}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                                    <HardDrive className="w-5 h-5 text-neutral-400 mb-2" />
                                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Size</p>
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{formatBytes(selectedItem.size)}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                                    <FileType className="w-5 h-5 text-neutral-400 mb-2" />
                                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Type</p>
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate" title={selectedItem.mimeType || selectedItem.type}>{selectedItem.mimeType || selectedItem.type}</p>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-neutral-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Date Added</p>
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{format(new Date(selectedItem.createdAt), 'PPpp')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={() => {
                                    if (fullScreenUrl && fullScreenUrl !== 'error' && fullScreenUrl !== '__TOO_LARGE__') {
                                        const a = document.createElement('a');
                                        a.href = fullScreenUrl;
                                        a.download = selectedItem.filename;
                                        a.target = '_blank';
                                        a.rel = 'noopener noreferrer';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    }
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </button>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(selectedItem.filename);
                                    alert('Filename copied to clipboard');
                                }}
                                className="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium flex items-center justify-center transition-colors"
                                title="Copy filename"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryView;
