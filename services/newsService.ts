import { NewsArticle } from '../types';
import { supabase } from './supabaseClient';

const responseCache = new Map<string, { data: NewsArticle[], timestamp: number }>();
const articleCache = new Map<string, { data: NewsArticle, timestamp: number }>();
const pendingRequests = new Map<string, Promise<NewsArticle[]>>();
const pendingArticleRequests = new Map<string, Promise<NewsArticle>>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export const fetchNews = async (category: string, summary: boolean = false): Promise<NewsArticle[]> => {
    const cacheKey = `${category}${summary ? '_summary' : ''}`;
    // Check cache first
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    // Check if request is already in flight
    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
        try {
            // Optimized Egress: Direct database queries replaced with cached backend API
            // which uses Vercel Edge Cache via GET requests.
            const response = await fetch(`/api/news?category=${encodeURIComponent(category)}${summary ? '&lite=true' : ''}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch from cache api');
            }

            const json = await response.json();
            const data = json.data;

            // Add a filter to prevent errors from malformed data with null article_data
            const results = data
                ? data
                    .filter((item: any) => item && item.article_data)
                    .map((item: any) => ({
                        ...(item.article_data as NewsArticle),
                        category: item.category,
                        formattedContent: typeof item.formatted_content_md === 'string' ? { markdown: item.formatted_content_md } : item.formatted_content_md,
                        views: item.views || 0,
                        likes: item.likes || 0,
                        bookmarks: item.bookmarks || 0,
                        dbId: item.id,
                    }))
                : [];
                
            responseCache.set(cacheKey, { data: results, timestamp: Date.now() });
            return results;
        } catch (error: any) {
            console.warn(`[News] Serverless fetch failed (${error.message}), falling back to direct Supabase query`);
            try {
                let query = supabase
                    .from('public_news_articles')
                    .select('id, category, article_data, views, likes, bookmarks')
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (category && category !== 'all') {
                    query = query.eq('category', category);
                }

                const { data: dbData, error: dbError } = await query;
                if (!dbError && dbData && dbData.length > 0) {
                    const fallbackResults = dbData
                        .filter((item: any) => item && item.article_data)
                        .map((item: any) => ({
                            ...(item.article_data as NewsArticle),
                            category: item.category,
                            formattedContent: typeof item.formatted_content_md === 'string' ? { markdown: item.formatted_content_md } : item.formatted_content_md,
                            views: item.views || 0,
                            likes: item.likes || 0,
                            bookmarks: item.bookmarks || 0,
                            dbId: item.id,
                        }));
                    responseCache.set(cacheKey, { data: fallbackResults, timestamp: Date.now() });
                    return fallbackResults;
                }
            } catch (fallbackError: any) {
                console.error(`[News] Direct Supabase fallback also failed:`, fallbackError.message);
            }

            // Log a more descriptive error, which directly fixes the "[object Object]" problem.
            const descriptiveError = error.message ? `${error.message}${error.details ? ` | Details: ${error.details}`: ''}` : JSON.stringify(error);
            console.error(`Error fetching news for category "${category}": ${descriptiveError}`);
            // Re-throw a standard Error to be handled by the UI.
            throw new Error(error.message || `Failed to fetch news for ${category}.`);
        } finally {
            pendingRequests.delete(cacheKey);
        }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
};

export const fetchArticleDetails = async (url: string): Promise<NewsArticle> => {
    // Check cache first
    const cached = articleCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    // Check if request is already in flight
    if (pendingArticleRequests.has(url)) {
        return pendingArticleRequests.get(url)!;
    }

    const fetchPromise = (async () => {
        try {
            const response = await fetch(`/api/news?url=${encodeURIComponent(url)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to fetch article details');
            }

            const json = await response.json();
            const item = json.data;
            
            if (!item || !item.article_data) {
                throw new Error('Article not found');
            }

            const result: NewsArticle = {
                ...(item.article_data as NewsArticle),
                category: item.category,
                formattedContent: { markdown: item.formatted_content_md },
                views: item.views || 0,
                likes: item.likes || 0,
                bookmarks: item.bookmarks || 0,
                dbId: item.id,
            };

            articleCache.set(url, { data: result, timestamp: Date.now() });
            return result;
        } catch (error: any) {
            console.warn(`[News] Serverless article fetch failed (${error.message}), falling back to direct Supabase query`);
            try {
                const { data: dbItem, error: dbError } = await supabase
                    .from('public_news_articles')
                    .select('id, category, article_data, formatted_content_md, views, likes, bookmarks')
                    .eq('article_data->>url', url)
                    .maybeSingle();

                if (!dbError && dbItem && dbItem.article_data) {
                    const fallbackResult: NewsArticle = {
                        ...(dbItem.article_data as NewsArticle),
                        category: dbItem.category,
                        formattedContent: { markdown: dbItem.formatted_content_md },
                        views: dbItem.views || 0,
                        likes: dbItem.likes || 0,
                        bookmarks: dbItem.bookmarks || 0,
                        dbId: dbItem.id,
                    };
                    articleCache.set(url, { data: fallbackResult, timestamp: Date.now() });
                    return fallbackResult;
                }
            } catch (fbErr: any) {
                console.error(`[News] Direct article fallback failed:`, fbErr.message);
            }

            console.error(`Error fetching article details for "${url}":`, error.message);
            throw new Error(error.message || `Failed to fetch article details.`);
        } finally {
            pendingArticleRequests.delete(url);
        }
    })();

    pendingArticleRequests.set(url, fetchPromise);
    return fetchPromise;
};