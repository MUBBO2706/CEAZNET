
import React, { useState, memo, useRef, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';

interface VideoCarouselProps {
    videos: { title: string; url: string; }[];
}

// Extract video ID helper
const getVideoId = (url: string) => {
    try {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) {
        return null;
    }
};

interface VideoCardProps {
    videoId: string;
    title: string;
    isActive: boolean; // True if this is the currently "playing" video
    isCentered: boolean; // True if this is the visually centered video
    onPlay: () => void;
    onVisibilityRatio: (videoId: string, ratio: number) => void;
}

const VideoCard: React.FC<VideoCardProps> = memo(({ videoId, title, isActive, isCentered, onPlay, onVisibilityRatio }) => {
    const [hasLoaded, setHasLoaded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const wasPlayingRef = useRef(false);

    // Helper to send commands to YouTube Iframe API
    const postCommand = (command: string) => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: command,
                args: []
            }), '*');
        }
    };

    const handlePlayClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setHasLoaded(true);
        wasPlayingRef.current = true;
        onPlay();
    };

    // 1. Reset Logic: If another video becomes active, completely unload this one (reset to thumbnail)
    useEffect(() => {
        if (!isActive && hasLoaded) {
            setHasLoaded(false);
            wasPlayingRef.current = false;
        }
    }, [isActive, hasLoaded]);

    // 2. Intersection Observer for Auto-Pause / Auto-Resume & Visual Centering
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                
                // Report visibility ratio to parent for centering logic
                onVisibilityRatio(videoId, entry.intersectionRatio);

                // Auto-Pause / Resume Logic
                if (hasLoaded) {
                    if (entry.isIntersecting) {
                        // Came back into view
                        if (isActive && wasPlayingRef.current) {
                            postCommand('playVideo');
                        }
                    } else {
                        // Went out of view
                        // If it was the active video, mark it as wasPlaying so we can resume later
                        if (isActive) {
                            wasPlayingRef.current = true;
                        }
                        postCommand('pauseVideo');
                    }
                }
            },
            {
                threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], 
                rootMargin: '0px'
            }
        );

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, [hasLoaded, isActive, videoId, onVisibilityRatio]);

    return (
        <div 
            ref={containerRef}
            className={`w-full h-full relative rounded-xl overflow-hidden border border-white/5 shadow-lg transition-all duration-500 ease-out ${
                isCentered 
                    ? 'scale-100 opacity-100 grayscale-0 z-10' 
                    : 'scale-90 opacity-60 grayscale-[50%] z-0'
            }`}
        >
            {hasLoaded ? (
                <div className="w-full h-full bg-black relative z-10 animate-fade-in-up overflow-hidden">
                    {/* 
                        TRICK: Make iframe 200% width/height and scale it down to 0.5.
                        This fools YouTube into rendering the player UI for a larger screen,
                        effectively making the controls look smaller and crisper relative to the video.
                    */}
                    <iframe
                        ref={iframeRef}
                        width="200%"
                        height="200%"
                        style={{ 
                            border: 0, 
                            transform: 'scale(0.5)', 
                            transformOrigin: 'top left',
                            width: '200%',
                            height: '200%'
                        }}
                        // enablejsapi=1 is crucial for postMessage to work
                        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&modestbranding=1&rel=0&playsinline=1`}
                        title={title || 'YouTube video player'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0"
                    ></iframe>
                </div>
            ) : (
                <button 
                    onClick={handlePlayClick}
                    className="group relative w-full h-full block cursor-pointer"
                    aria-label={`Play video: ${title}`}
                >
                    {/* Thumbnail */}
                    <img 
                        src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} 
                        srcSet={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg 320w, https://i.ytimg.com/vi/${videoId}/hqdefault.jpg 480w`}
                        sizes="(max-width: 640px) 240px, 320px"
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                    />
                    
                    {/* Dark Overlay */}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                    {/* Play Button */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-red-600 transition-all duration-300 shadow-lg border border-white/20 z-20">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-white ml-0.5" />
                    </div>

                    {/* Title Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                        <p className="text-white text-xs font-medium line-clamp-2 text-left leading-tight">
                            {title}
                        </p>
                    </div>
                </button>
            )}
        </div>
    );
});

const VideoCarousel: React.FC<VideoCarouselProps> = ({ videos }) => {
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [centeredVideoId, setCenteredVideoId] = useState<string | null>(null);
    const visibilityMap = useRef<Map<string, number>>(new Map());

    const validVideos = React.useMemo(() => 
        videos.filter(v => v.url && getVideoId(v.url)).map(v => ({...v, id: getVideoId(v.url)!})), 
    [videos]);

    // Initialize centered ID with the first video on mount
    useEffect(() => {
        if (validVideos.length > 0 && !centeredVideoId) {
            setCenteredVideoId(validVideos[0].id);
        }
    }, [validVideos, centeredVideoId]);

    // Determine which video is "most visible" to be the center styling focus
    const handleVisibilityUpdate = useCallback((videoId: string, ratio: number) => {
        visibilityMap.current.set(videoId, ratio);
        
        // Find ID with highest ratio
        let maxRatio = 0;
        let bestId = null;
        
        for (const [id, r] of visibilityMap.current.entries()) {
            if (r > maxRatio) {
                maxRatio = r;
                bestId = id;
            }
        }

        if (bestId && maxRatio > 0.5) {
            setCenteredVideoId(bestId);
        }
    }, []);

    if (validVideos.length === 0) return null;

    return (
        <div className="w-full my-2 animate-fade-in-up" style={{ contain: 'content' }}>
            <div 
                className="flex overflow-x-auto gap-2 pb-2 pt-0 -mx-4 px-4 md:-mx-0 md:px-0 scrollbar-hide snap-x snap-mandatory touch-pan-x items-center"
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {validVideos.map((video, idx) => (
                    <div 
                        key={`${video.id}-${idx}`} 
                        className="flex-shrink-0 w-[280px] sm:w-[380px] aspect-video relative snap-center"
                    >
                        <VideoCard 
                            videoId={video.id} 
                            title={video.title} 
                            isActive={activeVideoId === video.id}
                            isCentered={centeredVideoId === video.id}
                            onPlay={() => setActiveVideoId(video.id)}
                            onVisibilityRatio={handleVisibilityUpdate}
                        />
                    </div>
                ))}
                {/* Spacer to ensure right-most item is fully visible on mobile scroll */}
                <div className="w-2 flex-shrink-0 md:hidden"></div>
            </div>
        </div>
    );
};

export default memo(VideoCarousel);
