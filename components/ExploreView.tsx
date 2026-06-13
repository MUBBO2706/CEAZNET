
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, RefreshCw, ChevronsRight, ChevronsLeft, Compass, Cpu, BarChart3, FlaskConical, Stethoscope, Trophy, Drama, Bookmark } from 'lucide-react';
import { NewsArticle, UserArticleInteraction } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ArticleCard from './ArticleCard';
import ArticleCardSkeleton from './ArticleCardSkeleton';
import { useDynamicColors, defaultColors } from '../hooks/useDynamicColors';
import { getInteractions, saveInteraction, incrementStat } from '../services/dbService';
import BookmarkFeedSheet from './BookmarkFeedSheet';
import { supabase } from '../services/supabaseClient';
import { motion } from 'motion/react';

const allCategories = ['technology', 'business', 'science', 'health', 'sports', 'entertainment'];
const categories = ['for-you', ...allCategories];

const categoryIcons: Record<string, React.ElementType> = {
    'for-you': Compass,
    'technology': Cpu,
    'business': BarChart3,
    'science': FlaskConical,
    'health': Stethoscope,
    'sports': Trophy,
    'entertainment': Drama,
};

interface ExploreViewProps {
    onBack: () => void;
    user: SupabaseUser | null;
    onReadArticle: (article: NewsArticle) => void;
    currentIndex: number;
    setCurrentIndex: (updater: (prev: number) => number) => void;
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    articles: NewsArticle[];
    setArticles: React.Dispatch<React.SetStateAction<NewsArticle[]>>;
    isLoading: boolean;
    error: string | null;
    interactions: Record<string, UserArticleInteraction>;
    handleInteraction: (articleUrl: string, type: 'like' | 'bookmark') => void;
    isBookmarkFeedOpen: boolean;
    setIsBookmarkFeedOpen: (isOpen: boolean) => void;
    bookmarkCount: number | null;
}

const ExploreView: React.FC<ExploreViewProps> = ({
    onBack,
    user,
    onReadArticle,
    currentIndex,
    setCurrentIndex,
    activeCategory,
    setActiveCategory,
    articles,
    setArticles,
    isLoading,
    error,
    interactions,
    handleInteraction,
    isBookmarkFeedOpen,
    setIsBookmarkFeedOpen,
    bookmarkCount,
}) => {
    const navigate = useNavigate();
    const [dragState, setDragState] = React.useState({ x: 0, isDragging: false });
    const dragStartRef = React.useRef(0);
    const currentDragXRef = React.useRef(0);
    const activeCardRef = React.useRef<HTMLDivElement>(null);
    const [isProgressBarPaused, setIsProgressBarPaused] = useState(false);
    const holdTimerRef = useRef<number | null>(null);
    const [isDesktop, setIsDesktop] = useState(false);

    // Check for desktop view to switch layouts
    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.matchMedia('(min-width: 768px)').matches);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    const currentArticle = useMemo(() => articles.length > currentIndex ? articles[currentIndex] : null, [articles, currentIndex]);
    // Only calculate dynamic colors for the mobile swipe view to save resources
    const { colors } = useDynamicColors(isDesktop ? null : (currentArticle?.image || null), !isDesktop);

    // Use neutral/fixed colors for Desktop grid background
    const backgroundStyle = isDesktop 
        ? { background: 'transparent' } 
        : { background: isLoading ? 'transparent' : colors.exploreBg, transition: 'background 1.5s ease-in-out' };

    const handleNext = useCallback(() => {
        if (articles.length > 0) {
            setCurrentIndex(prev => (prev + 1) % articles.length);
        }
    }, [articles.length, setCurrentIndex]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button, a')) return;

        if (activeCategory === 'for-you') {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            holdTimerRef.current = window.setTimeout(() => {
                setIsProgressBarPaused(true);
            }, 150);
        } else {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragStartRef.current = e.clientX;
            currentDragXRef.current = 0;
            setDragState({ x: 0, isDragging: true });
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activeCategory === 'for-you' || !dragState.isDragging) return;
        const deltaX = e.clientX - dragStartRef.current;
        currentDragXRef.current = deltaX;
        
        // Direct DOM manipulation for performance
        if (activeCardRef.current) {
            const rotation = deltaX / 20;
            activeCardRef.current.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`;
            activeCardRef.current.style.transition = 'none';
        }
    };

    const handlePointerUpOrLeave = (e: React.PointerEvent<HTMLDivElement>) => {
        if (activeCategory === 'for-you') {
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
            setIsProgressBarPaused(false);
        } else {
            if (!dragState.isDragging) return;
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            
            const SWIPE_THRESHOLD = e.currentTarget.clientWidth / 3;
            const finalDragX = currentDragXRef.current;

            if (Math.abs(finalDragX) > SWIPE_THRESHOLD) {
                if (finalDragX < 0) { // Swipe left
                    setCurrentIndex(prev => (prev + 1));
                } else { // Swipe right
                    setCurrentIndex(prev => (Math.max(prev - 1, 0)));
                }
            }
            
            // Reset styles on the ref element before state update takes over
            if (activeCardRef.current) {
                activeCardRef.current.style.transform = '';
                activeCardRef.current.style.transition = '';
            }
            
            setDragState({ x: 0, isDragging: false });
            currentDragXRef.current = 0;
        }
    };
    
    const handleUnbookmarkInSheet = useCallback((articleUrl: string) => {
         handleInteraction(articleUrl, 'bookmark');
    }, [handleInteraction]);

    return (
        <main 
            className={`h-full flex flex-col bg-pan-animation ${isDesktop ? 'overflow-y-auto' : 'overflow-hidden'}`}
            style={backgroundStyle}
        >
            <div className="relative z-10 pt-20 md:pt-24 pb-2 flex-shrink-0">
                <div className="overflow-x-auto scrollbar-hide px-4 md:px-8 py-2">
                    <div className="flex items-center gap-3 md:gap-4 min-w-max mx-auto md:justify-center">
                        {categories.map(category => {
                            const Icon = categoryIcons[category] || Compass;
                            const label = category === 'for-you' ? 'For You' : category.charAt(0).toUpperCase() + category.slice(1);
                            const isActive = activeCategory === category;
                            
                            return (
                                <button
                                    key={category}
                                    onClick={() => navigate('/explore/' + category)}
                                    className={`
                                        group relative px-4 py-2 md:px-5 md:py-2.5 rounded-full 
                                        flex items-center gap-2 transition-all duration-300 ease-out
                                        ${isActive 
                                            ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-105 font-bold ring-1 ring-white/50' 
                                            : 'bg-black/20 md:bg-white/5 text-white/70 hover:bg-white/10 hover:text-white hover:scale-105 backdrop-blur-md border border-white/5'
                                        }
                                    `}
                                >
                                    <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110 stroke-[2.5px]' : 'group-hover:scale-110'}`} />
                                    <span className="text-sm tracking-wide">{label}</span>
                                    
                                    {isActive && (
                                        <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/10 pointer-events-none"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MOBILE LAYOUT: Swipe Stack */}
            <div
                className="relative flex-1 flex items-center justify-center overflow-hidden touch-pan-y md:hidden"
                style={activeCategory === 'for-you' ? { userSelect: 'none', WebkitTouchCallout: 'none' } : {}}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrLeave}
                onPointerCancel={handlePointerUpOrLeave}
                onContextMenu={(e) => { if (activeCategory === 'for-you') e.preventDefault() }}
            >
                <div className="relative w-full h-full flex items-center justify-center max-w-md mx-auto px-4">
                    {isLoading && (
                        [...Array(3)].map((_, index) => {
                            const offset = index;
                            const style = {
                                transform: `translateY(${offset * 10}px) scale(${1 - offset * 0.05})`,
                                opacity: 1,
                                zIndex: -offset,
                            };
                            return <ArticleCardSkeleton key={index} style={style} />;
                        })
                    )}

                    {error && (
                        <div className="text-center p-4">
                            <WifiOff className="h-12 w-12 mx-auto text-red-400 mb-4" />
                            <h2 className="text-xl font-semibold text-red-300">Could Not Fetch News</h2>
                            <p className="mt-2 text-red-400 max-w-md mx-auto">{error}</p>
                        </div>
                    )}

                    {!isLoading && !error && articles.length === 0 && (
                         <p className="text-neutral-400">No articles found for this category.</p>
                    )}
                    
                    {!isLoading && !error && articles.length > 0 && currentIndex >= articles.length && (
                         <div className="text-center p-4">
                            <h2 className="text-xl font-semibold text-white mb-4">You've reached the end!</h2>
                            <button onClick={() => navigate('/explore/' + categories[0])} className="flex items-center gap-2 mx-auto px-4 py-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm">
                                <RefreshCw className="h-4 w-4" />
                                Start Over
                            </button>
                        </div>
                    )}

                    {!isLoading && articles.map((article, index) => {
                        const isTop = index === currentIndex;
                        const offset = index - currentIndex;
                        if (offset < 0 || offset > 3) return null;
                        
                        return (
                            <ArticleCard
                                key={`${article.url}-${index}`}
                                ref={isTop ? activeCardRef : null}
                                article={article}
                                isTop={isTop}
                                offset={offset}
                                dragX={isTop ? dragState.x : 0}
                                isDragging={isTop ? dragState.isDragging : false}
                                onReadArticle={onReadArticle}
                                isLiked={interactions[article.url]?.liked ?? false}
                                isBookmarked={interactions[article.url]?.bookmarked ?? false}
                                onLike={() => handleInteraction(article.url, 'like')}
                                onBookmark={() => handleInteraction(article.url, 'bookmark')}
                                variant="stack"
                            />
                        );
                    })}
                </div>
            </div>
            
            {/* MOBILE CONTROLS */}
            <div className="relative z-10 flex justify-center items-center gap-4 p-4 flex-shrink-0 md:hidden" style={{ height: '68px' }}>
                {(() => {
                    if (isLoading) {
                        if (activeCategory === 'for-you') {
                            return (
                                <div className="w-full max-w-xs px-4 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-white/20 rounded-full"></div>
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                <>
                                    <div className="p-2 bg-white/10 rounded-full w-[40px] h-[40px] animate-pulse"></div>
                                    <div className="h-3 w-12 bg-white/20 rounded-md animate-pulse"></div>
                                    <div className="p-2 bg-white/10 rounded-full w-[40px] h-[40px] animate-pulse"></div>
                                </>
                            );
                        }
                    }

                    if (error || articles.length === 0 || currentIndex >= articles.length) {
                        return null;
                    }
                    
                    if (activeCategory === 'for-you') {
                        return (
                           <div className="w-full max-w-xs px-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                                        <div 
                                            key={currentIndex} 
                                            className="h-full bg-gradient-to-r from-white/80 to-white rounded-full"
                                            onAnimationEnd={handleNext}
                                            style={{ 
                                                animation: 'progress-bar-anim 10s linear forwards',
                                                animationPlayState: isProgressBarPaused ? 'paused' : 'running',
                                            }}
                                        >
                                           <div className="absolute inset-0 progress-bar-shimmer"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    } else {
                        return (
                            <>
                                <button onClick={() => setCurrentIndex(() => currentIndex - 1)} disabled={currentIndex === 0} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-50 transition-colors backdrop-blur-sm">
                                    <ChevronsLeft className="h-5 w-5" />
                                </button>
                                <div className="text-xs font-medium text-white">{currentIndex + 1} / {articles.length}</div>
                                <button onClick={() => setCurrentIndex(() => currentIndex + 1)} disabled={currentIndex >= articles.length - 1} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-50 transition-colors backdrop-blur-sm">
                                    <ChevronsRight className="h-5 w-5" />
                                </button>
                            </>
                        );
                    }
                })()}
            </div>

            {/* DESKTOP LAYOUT: Grid View */}
            <div className="hidden md:block flex-1 overflow-y-auto px-6 pb-10">
                {isLoading ? (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="w-full rounded-3xl bg-neutral-200 dark:bg-gray-900 h-[400px] animate-pulse"></div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center p-12">
                        <WifiOff className="h-16 w-16 mx-auto text-red-400 mb-4" />
                        <h2 className="text-2xl font-semibold text-neutral-800 dark:text-gray-200">Could Not Fetch News</h2>
                        <p className="mt-2 text-neutral-600 dark:text-gray-400 max-w-md mx-auto">{error}</p>
                    </div>
                ) : articles.length === 0 ? (
                    <div className="text-center p-12 text-neutral-500 dark:text-gray-400">
                        No articles available.
                    </div>
                ) : (
                    <motion.div 
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto"
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: {
                                opacity: 1,
                                transition: {
                                    staggerChildren: 0.1
                                }
                            }
                        }}
                    >
                        {articles.map((article, index) => (
                            <motion.div
                                key={`${article.url}-grid-${index}`}
                                variants={{
                                    hidden: { opacity: 0, y: 30 },
                                    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                                }}
                            >
                                <ArticleCard
                                    article={article}
                                    onReadArticle={onReadArticle}
                                    isLiked={interactions[article.url]?.liked ?? false}
                                    isBookmarked={interactions[article.url]?.bookmarked ?? false}
                                    onLike={() => handleInteraction(article.url, 'like')}
                                    onBookmark={() => handleInteraction(article.url, 'bookmark')}
                                    variant="grid"
                                    className="h-full"
                                />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
            
            <BookmarkFeedSheet
                isOpen={isBookmarkFeedOpen}
                onClose={() => setIsBookmarkFeedOpen(false)}
                user={user}
                onReadArticle={(article) => {
                    onReadArticle(article);
                    setIsBookmarkFeedOpen(false);
                }}
                onUnbookmark={handleUnbookmarkInSheet}
                bookmarkCount={bookmarkCount}
            />
        </main>
    );
};

export default ExploreView;
