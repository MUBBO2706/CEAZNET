
import React, { useMemo, useState } from 'react';
import { NewsArticle } from '../types';
import { useDynamicColors } from '../hooks/useDynamicColors';
import { useCachedImage } from '../services/imageCachingService';
import ArticleCardSkeleton from './ArticleCardSkeleton';
import { Eye, Heart } from 'lucide-react';
import LikeAnimation from './LikeAnimation';

interface ArticleCardProps {
    article: NewsArticle;
    isTop?: boolean;
    offset?: number;
    dragX?: number;
    isDragging?: boolean;
    onReadArticle: (article: NewsArticle) => void;
    isLiked: boolean;
    isBookmarked: boolean;
    onLike: () => void;
    onBookmark: () => void;
    variant?: 'stack' | 'grid';
    className?: string;
}

const BookmarkIcon: React.FC<{ color: string, filled: boolean }> = ({ color, filled }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill={filled ? color : 'none'} 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="h-6 w-6"
    >
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
    </svg>
);

const formatStat = (num?: number): string => {
    if (num === undefined || num === null) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
    return `${(num / 1000000).toFixed(1)}m`;
};

const ArticleCard = React.forwardRef<HTMLDivElement, ArticleCardProps>(({ 
    article, 
    isTop = false, 
    offset = 0, 
    dragX = 0, 
    isDragging = false, 
    onReadArticle,
    isLiked,
    isBookmarked,
    onLike,
    onBookmark,
    variant = 'stack',
    className = ''
}, ref) => {
    // Enable dynamic colors for both stack and grid
    const enableDynamicColors = true;
    const cachedImageSrc = useCachedImage(article.image || null);
    const { colors, isLoading } = useDynamicColors(article.image || null, enableDynamicColors);
    const [isAnimating, setIsAnimating] = useState(false);

    const style: React.CSSProperties = useMemo(() => {
        if (variant === 'grid') {
            return {}; // No special transforms for grid
        }

        if (isTop) {
            // If dragging, we handle transform via direct DOM manipulation in parent for performance
            // But we still need to set initial state or non-dragging state
            if (isDragging) return { touchAction: 'none' };

            const rotation = dragX / 20;
            return {
                transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
                touchAction: 'none',
            };
        }
        return {
            transform: `translateY(${offset * 10}px) scale(${1 - offset * 0.05})`,
            opacity: offset < 3 ? 1 : 0,
            zIndex: -offset,
            transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        };
    }, [isTop, offset, dragX, isDragging, variant]);
    
    const hostname = useMemo(() => {
        try {
            return new URL(article.url).hostname.replace(/^www\./, '');
        } catch {
            return article.source.name || 'news';
        }
    }, [article.url, article.source.name]);

    const formattedDate = useMemo(() => {
        try {
            const date = new Date(article.publishedAt);
            const datePart = date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
            });
            const timePart = date.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
            return `${datePart} at ${timePart}`;
        } catch {
            return '';
        }
    }, [article.publishedAt]);

    // Skeleton handling
    if (isLoading && variant === 'stack' && isTop) {
        return <ArticleCardSkeleton style={style} />;
    }
    if (isLoading && variant === 'stack' && !isTop) {
        return <div style={style} />;
    }

    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    const handleLikeClick = (e: React.MouseEvent) => {
        stopPropagation(e);
        if (!isLiked) {
            setIsAnimating(true);
        }
        onLike();
    };
    
    // Determine colors to use. Grid view uses a neutral card look.
    const usedColors = variant === 'grid' 
        ? {
            background: '#ffffff', // White for light mode
            text: '#111827',
            subText: '#6b7280',
        } 
        : colors;

    // Corrected classes: Inner card is relative in stack mode to respect padding
    const gridClasses = variant === 'grid' 
        ? 'relative h-full flex flex-col bg-white dark:bg-[#2E2F33] border border-neutral-200 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300' 
        : 'relative w-full shadow-2xl'; 

    // For grid view dark mode overrides since we aren't using dynamic colors there
    const textStyle = variant === 'grid' ? {} : { color: usedColors.text };
    const subTextStyle = variant === 'grid' ? {} : { color: usedColors.subText };
    const bgStyle = variant === 'grid' ? {} : { background: usedColors.background };

    return (
        <div
            ref={ref}
            className={`${variant === 'stack' ? 'absolute w-full p-4 will-change-transform' : ''} ${className}`}
            style={style}
        >
            <div
                className={`w-full rounded-3xl overflow-hidden flex flex-col transition-colors duration-500 ${gridClasses}`}
                onClick={isTop || variant === 'grid' ? () => onReadArticle(article) : undefined}
                style={{ 
                    cursor: (isTop || variant === 'grid') ? 'pointer' : 'default',
                    ...bgStyle
                }}
            >
                <div className="p-3">
                    <div className="w-full aspect-[4/3] flex-shrink-0 relative rounded-2xl overflow-hidden group bg-neutral-100 dark:bg-gray-800">
                        <img
                            src={cachedImageSrc || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?q=80&w=2070&auto-format&fit=crop'}
                            alt={article.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?q=80&w=2070&auto-format&fit=crop'; }}
                        />
                        <LikeAnimation animating={isAnimating} onAnimationEnd={() => setIsAnimating(false)} position="absolute" />
                    </div>
                </div>
                 <div className="flex-1 px-5 pb-5 flex flex-col">
                    <div>
                        <div className={`flex justify-between items-center text-xs font-medium mb-2 ${variant === 'grid' ? 'text-neutral-500 dark:text-gray-400' : ''}`} style={subTextStyle}>
                            <span className="flex items-center min-w-0">
                                <img
                                    src={`https://icons.duckduckgo.com/ip3/${hostname}.ico`}
                                    alt={`${hostname} favicon`}
                                    className="w-4 h-4 rounded-sm mr-2 flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <span className="truncate">{article.source.name}</span>
                            </span>
                            <span>{formattedDate}</span>
                        </div>
                        <h3 className={`font-bold text-xl leading-tight mb-2 line-clamp-2 ${variant === 'grid' ? 'text-neutral-900 dark:text-white' : ''}`} style={textStyle}>
                            {article.title}
                        </h3>
                        {article.description && (
                            <p className={`text-sm line-clamp-3 ${variant === 'grid' ? 'text-neutral-600 dark:text-gray-400' : ''}`} style={subTextStyle}>
                                {article.description}
                            </p>
                        )}
                    </div>
                    <div className="mt-auto pt-4 flex items-center justify-between">
                        <div className={`flex items-center gap-4 text-sm font-medium ${variant === 'grid' ? 'text-neutral-500 dark:text-gray-400' : ''}`} style={subTextStyle} onClick={stopPropagation}>
                            <div className="flex items-center gap-1.5">
                                <Eye className="h-5 w-5" />
                                <span>{formatStat(article.views)}</span>
                            </div>
                             <button onClick={handleLikeClick} className="flex items-center gap-1.5 group">
                                <Heart className={`h-5 w-5 transition-all ${isLiked ? 'text-red-500 fill-current' : 'group-hover:text-red-400'}`} />
                                <span>{formatStat(article.likes)}</span>
                            </button>
                        </div>
                        <button onClick={(e) => { stopPropagation(e); onBookmark(); }} className={`p-2 -m-2 ${variant === 'grid' ? 'text-neutral-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400' : ''}`} style={subTextStyle}>
                           <BookmarkIcon color="currentColor" filled={isBookmarked} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

ArticleCard.displayName = 'ArticleCard';

export default ArticleCard;
