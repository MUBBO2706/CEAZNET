import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Bookmark, LoaderCircle, WifiOff } from 'lucide-react';
import { NewsArticle, UserArticleInteraction } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import BookmarkListItem from './BookmarkListItem';
import BookmarkListItemSkeleton from './BookmarkListItemSkeleton';
import { saveInteraction, incrementStat } from '../services/dbService';

const ANON_INTERACTIONS_KEY = 'kalina_anon_interactions';

interface BookmarkFeedSheetProps {
    isOpen: boolean;
    onClose: () => void;
    user: SupabaseUser | null;
    onReadArticle: (article: NewsArticle) => void;
    onUnbookmark: (articleUrl: string) => void;
    bookmarkCount: number | null;
}

const BookmarkFeedSheet: React.FC<BookmarkFeedSheetProps> = ({ isOpen, onClose, user, onReadArticle, onUnbookmark, bookmarkCount }) => {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBookmarkedArticles = async () => {
            if (!isOpen) return;

            setIsLoading(true);
            setError(null);
            setArticles([]);

            let bookmarkedUrls: string[] = [];

            try {
                // 1. Get list of bookmarked URLs
                if (user) {
                    const { data, error: fetchError } = await supabase
                        .from('user_article_interactions')
                        .select('article_url')
                        .eq('user_id', user.id)
                        .eq('bookmarked', true);

                    if (fetchError) throw fetchError;
                    bookmarkedUrls = data.map(item => item.article_url);
                } else {
                    const stored = localStorage.getItem(ANON_INTERACTIONS_KEY);
                    if (stored) {
                        const allInteractions: Record<string, { liked: boolean; bookmarked: boolean }> = JSON.parse(stored);
                        bookmarkedUrls = Object.entries(allInteractions)
                            .filter(([, value]) => value.bookmarked)
                            .map(([key]) => key);
                    }
                }

                if (bookmarkedUrls.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Fetch article data for those URLs
                const { data: articleData, error: articleError } = await supabase
                    .from('public_news_articles')
                    .select('article_data, views, likes, bookmarks')
                    .in('article_data->>url', bookmarkedUrls);

                if (articleError) throw articleError;

                const fetchedArticles = articleData ? articleData.map(item => ({
                    ...(item.article_data as NewsArticle),
                    formattedContent: undefined,
                    views: item.views || 0,
                    likes: item.likes || 0,
                    bookmarks: item.bookmarks || 0,
                })) : [];
                
                // Sort by published date, most recent first
                fetchedArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

                setArticles(fetchedArticles);

            } catch (err: any) {
                console.error("Error fetching bookmarked articles:", err);
                setError(err.message || 'Failed to load bookmarks.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchBookmarkedArticles();
    }, [isOpen, user?.id]);
    
    const handleUnbookmark = useCallback(async (articleUrl: string) => {
        // Optimistic UI update
        setArticles(prev => prev.filter(a => a.url !== articleUrl));
        onUnbookmark(articleUrl);
    }, [onUnbookmark]);

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={`fixed top-0 right-0 bottom-0 z-50 bg-white dark:bg-black w-full max-w-md shadow-2xl transition-transform duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex flex-col h-full">
                    <header className="px-6 py-6 flex items-center justify-between flex-shrink-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10 sticky top-0">
                        <div>
                            <h2 className="text-2xl font-serif font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                                <Bookmark className="h-6 w-6 text-emerald-500 fill-current" />
                                Saved Stories
                            </h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                                {articles.length} {articles.length === 1 ? 'article' : 'articles'} for later
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group"
                            aria-label="Close bookmarks view"
                        >
                            <X className="h-5 w-5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
                        </button>
                    </header>
                    <div className="overflow-y-auto flex-1 px-4 pb-20">
                        {isLoading && (
                            <div className="space-y-4 mt-4">
                                {/* Use the passed bookmarkCount for skeleton, default to 5 if null, but don't show more than 10 */}
                                {[...Array(Math.min(bookmarkCount ?? 5, 10))].map((_, i) => (
                                    <BookmarkListItemSkeleton key={i} />
                                ))}
                            </div>
                        )}
                        {error && (
                            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                                    <WifiOff className="h-8 w-8 text-red-500 dark:text-red-400" />
                                </div>
                                <p className="text-neutral-900 dark:text-white font-medium">{error}</p>
                            </div>
                        )}
                        {!isLoading && !error && articles.length === 0 && (
                             <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                                <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-6">
                                    <Bookmark className="h-10 w-10 text-neutral-400 dark:text-neutral-600" />
                                </div>
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No saved stories yet</h3>
                                <p className="text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                                    Tap the bookmark icon on any article to save it here for later reading.
                                </p>
                            </div>
                        )}
                        {!isLoading && !error && articles.length > 0 && (
                            <ul className="space-y-4 mt-2">
                                {articles.map(article => (
                                    <li key={article.url}>
                                        <BookmarkListItem 
                                            article={article} 
                                            onClick={() => onReadArticle(article)}
                                            onUnbookmark={() => handleUnbookmark(article.url)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default BookmarkFeedSheet;