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
        <div className="group relative w-full">
            <button
                onClick={onClick}
                className="w-full text-left px-6 py-4 flex gap-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] active:bg-black/[0.06] dark:active:bg-white/[0.08] transition-colors duration-200"
            >
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
                    <img
                        src={cachedImage || ''}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto-format&fit=crop'; }}
                    />
                    <div className="absolute inset-0 bg-black/5 dark:bg-black/20 group-hover:bg-transparent transition-colors duration-200" />
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
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
                        <h3 className="font-serif font-medium text-base sm:text-lg leading-snug text-neutral-900 dark:text-neutral-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors pr-6">
                            {article.title}
                        </h3>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {Math.ceil(article.content?.length / 1000 || 3)} min read
                        </div>
                    </div>
                </div>
            </button>
            
            <button 
                onClick={handleUnbookmarkClick}
                className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors duration-200"
                aria-label="Remove bookmark"
                title="Remove from saved"
            >
                <Bookmark className="h-4 w-4 fill-current text-emerald-500 group-hover:text-neutral-400 hover:!text-red-500 transition-colors" />
            </button>
        </div>
    );
};

export default BookmarkListItem;