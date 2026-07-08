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
            console.error(`Error fetching article details for "${url}":`, error.message);
            throw new Error(error.message || `Failed to fetch article details.`);
        } finally {
            pendingArticleRequests.delete(url);
        }
    })();

    pendingArticleRequests.set(url, fetchPromise);
    return fetchPromise;
};