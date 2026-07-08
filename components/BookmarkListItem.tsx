import React, { useMemo } from 'react';
import { NewsArticle } from '../types';
import { Bookmark } from 'lucide-react';
import { useCachedImage } from '../services/imageCachingService';

interface BookmarkListItemProps {
    article: NewsArticle;
    onClick: () => void;
    onUnbookmark: () => void;
}

const BookmarkListItem: React.FC<BookmarkListItemProps> = ({ article, onClick, onUnbookmark }) => {
    const cachedImage = useCachedImage(article.image || null);
    
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
                year: 'numeric',
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
    
    const handleUnbookmarkClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUnbookmark();
    };

    return (
        <div className="group relative">
            <button
                onClick={onClick}
                className="w-full text-left p-3 flex gap-4 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-2xl transition-all duration-300 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 group-hover:shadow-lg dark:group-hover:shadow-none"
            >
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 overflow-hidden rounded-xl">
                    <img
                        src={cachedImage || ''}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto-format&fit=crop'; }}
                    />
                    <div className="absolute inset-0 bg-black/5 dark:bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                                <img
                                    src={`https://icons.duckduckgo.com/ip3/${hostname}.ico`}
                                    alt=""
                                    className="w-3 h-3 rounded-sm"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                {article.source.name}
                            </span>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">{formattedDate}</span>
                        </div>
                        <h3 className="font-serif font-medium text-lg leading-snug text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {article.title}
                        </h3>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-neutral-400 dark:text-neutral-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {Math.ceil(article.content?.length / 1000 || 3)} min read
                        </div>
                    </div>
                </div>
            </button>
            
            <button 
                onClick={handleUnbookmarkClick}
                className="absolute top-2 right-2 p-2 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-sm text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-white dark:hover:bg-neutral-800 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
                aria-label="Remove bookmark"
                title="Remove from saved"
            >
                <Bookmark className="h-4 w-4 fill-current" />
            </button>
        </div>
    );
};

export default BookmarkListItem;