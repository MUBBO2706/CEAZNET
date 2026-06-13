
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ExternalLink, WifiOff, ArrowUp, Mic, ChevronUp, ChevronDown, MessageSquare, Eye, Heart } from 'lucide-react';
import { NewsArticle, ChatMessage, ArticleConversation, GroundingChunk, UserArticleInteraction } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getAiClient } from '../services/aiClient';
import { getArticleConversation, saveArticleConversation, getPublicArticleCache, savePublicArticleCache, incrementStat, getSetting } from '../services/dbService';
import { fetchNews, fetchArticleDetails } from '../services/newsService';
import { supabase } from '../services/supabaseClient';
import { TextShimmer } from './core/TextShimmer';
import { LoaderCircle } from 'lucide-react';
import ReadingProgressBar from './ReadingProgressBar';
import LikeAnimation from './LikeAnimation';
import RelatedArticleCard from './RelatedArticleCard';
import { formatStat } from '../utils/stringUtils';
import { fetchAndParseUrlContent } from '../services/urlReaderService';

const FollowUpSkeletonLoader: React.FC = () => (
    <div className="space-y-3 py-2">
        <div className="h-4 shimmer-bg rounded w-5/6"></div>
        <div className="h-4 shimmer-bg rounded w-full"></div>
    </div>
);

const SkeletonLoader: React.FC = () => (
    <div className="animate-pulse">
        <div className="h-8 bg-neutral-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-neutral-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
        <div className="h-56 bg-neutral-200 dark:bg-gray-700 rounded-lg mb-6"></div>
        <div className="space-y-3">
            <div className="h-4 bg-neutral-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-neutral-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-neutral-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-neutral-200 dark:bg-gray-700 rounded w-full mt-4"></div>
            <div className="h-4 bg-neutral-200 dark:bg-gray-700 rounded w-4/6"></div>
        </div>
    </div>
);

const FollowUpConversation: React.FC<{ 
    messages: ChatMessage[],
    isAnswering: boolean,
    isContentLoading: boolean,
    followUpError: string | null,
    isFollowUpOpen: boolean,
    setIsFollowUpOpen: (isOpen: boolean) => void,
    followUpQuestion: string,
    setFollowUpQuestion: (q: string) => void,
    handleAskFollowUp: () => void,
    hostname: string;
}> = ({ messages, isAnswering, isContentLoading, followUpError, isFollowUpOpen, setIsFollowUpOpen, followUpQuestion, setFollowUpQuestion, handleAskFollowUp, hostname }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            textarea.style.height = `${scrollHeight}px`;
        }
    }, [followUpQuestion]);

    useEffect(() => {
        if (isFollowUpOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isFollowUpOpen]);

    return (
         <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
            <div className="max-w-3xl mx-auto p-4 space-y-2">
                {isFollowUpOpen && (
                    <div 
                        className={`pointer-events-auto bg-neutral-200/50 dark:bg-black/30 backdrop-blur-md rounded-xl shadow-xl transition-all duration-300 max-h-80 flex flex-col animate-fade-in-up`}
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pt-6 pb-4 space-y-4 scroll-fade" style={{ touchAction: 'pan-y' }}>
                            {messages.map((msg, index) => {
                                const isStreaming = isAnswering && index === messages.length - 1;
                                if (msg.role === 'user') {
                                    return (
                                        <div key={msg.id} className="flex justify-end">
                                            <div className="p-3 rounded-lg max-w-sm sm:max-w-md bg-amber-100 dark:bg-amber-900/40 text-neutral-800 dark:text-gray-200">
                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                        </div>
                                    );
                                } else { // Model message
                                    return (
                                        <div key={msg.id} className="flex justify-start">
                                            <div className="w-full max-w-sm sm:max-w-md prose-style">
                                                {(isStreaming && !msg.content && !isContentLoading) ? (
                                                    <FollowUpSkeletonLoader />
                                                ) : (
                                                    <MarkdownRenderer content={msg.content} sources={msg.sources} isStreaming={isStreaming} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                            })}

                            {isContentLoading && (
                                <div className="flex justify-start">
                                    <div className="flex items-center gap-2 p-3">
                                        <TextShimmer className="text-sm text-neutral-600 dark:text-gray-300">
                                            Reading content from {hostname}...
                                        </TextShimmer>
                                    </div>
                                </div>
                            )}

                            {followUpError && <p className="text-red-500 text-sm">{followUpError}</p>}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                )}
                
                <div className="relative bg-neutral-200/50 dark:bg-black/30 backdrop-blur-md rounded-full p-2 flex items-center gap-2 shadow-2xl pointer-events-auto border border-black/20 dark:border-white/20">
                    <button onClick={() => setIsFollowUpOpen(!isFollowUpOpen)} className="p-2 ml-1 text-gray-500 dark:text-gray-400">
                        {isFollowUpOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={followUpQuestion}
                        onChange={(e) => setFollowUpQuestion(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAskFollowUp();
                            }
                        }}
                        placeholder="Ask follow-up..."
                        className="flex-1 bg-transparent text-neutral-800 dark:text-white placeholder-neutral-500 dark:placeholder-gray-400 focus:outline-none resize-none text-base leading-tight py-4 max-h-24 scrollbar-hide"
                    />
                    <button 
                        onClick={handleAskFollowUp} 
                        disabled={isAnswering || !followUpQuestion.trim()}
                        className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-300 dark:bg-gray-600 flex items-center justify-center text-neutral-700 dark:text-white disabled:opacity-50 transition-colors hover:bg-neutral-400 dark:hover:bg-gray-500"
                        aria-label="Send follow-up question"
                    >
                        {isAnswering || isContentLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface ArticleReaderViewProps {
    article: NewsArticle;
    onBack: () => void;
    user: SupabaseUser | null;
    interactions: Record<string, UserArticleInteraction>;
    handleInteraction: (articleUrl: string, type: 'like' | 'bookmark') => void;
    allArticles: NewsArticle[];
    onReadArticle: (article: NewsArticle) => void;
    onArticleUpdate: (article: NewsArticle) => void;
}

const RelatedArticleCardSkeleton: React.FC = () => (
    <div className="flex-shrink-0 w-56 rounded-xl p-3 flex flex-col gap-3">
        <div className="relative w-full h-28 rounded-lg shimmer-bg flex-shrink-0">
             <div className="absolute bottom-2 left-2 h-4 w-16 rounded-full shimmer-bg" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
                <div className="flex items-center mb-1">
                    <div className="w-4 h-4 rounded-sm mr-2 shimmer-bg" />
                    <div className="h-3 w-20 rounded shimmer-bg" />
                </div>
                <div className="space-y-1.5 mt-2">
                    <div className="h-3 w-full rounded shimmer-bg" />
                    <div className="h-3 w-4/5 rounded shimmer-bg" />
                </div>
            </div>
            <div className="flex justify-between items-center mt-2">
                <div className="h-3 w-12 rounded shimmer-bg" />
                <div className="h-3 w-8 rounded shimmer-bg" />
            </div>
        </div>
    </div>
);


const getArticleMarkdown = (formattedContent: any): string => {
    if (!formattedContent) return '';
    if (typeof formattedContent === 'string') {
        return formattedContent;
    }
    if (typeof formattedContent === 'object') {
        if (typeof formattedContent.markdown === 'string') {
            return formattedContent.markdown;
        }
        if (formattedContent.markdown && typeof formattedContent.markdown === 'object' && typeof formattedContent.markdown.markdown === 'string') {
            return formattedContent.markdown.markdown;
        }
    }
    return '';
};

const hasMarkdownContent = (formattedContent: any): boolean => {
    return !!getArticleMarkdown(formattedContent);
};

const ArticleReaderView: React.FC<ArticleReaderViewProps> = ({ article: initialArticle, onBack, user, interactions, handleInteraction, allArticles, onReadArticle, onArticleUpdate }) => {
    const [article, setArticle] = useState<NewsArticle>(initialArticle);
    const [articleRowId, setArticleRowId] = useState<string | null>(null);
    const [conversation, setConversation] = useState<ArticleConversation | null>(null);

    // Fetch the full article details if missing (optimized payload)
    useEffect(() => {
        const fetchFullArticle = async () => {
            if (!hasMarkdownContent(article.formattedContent)) {
                try {
                    const fullArticle = await fetchArticleDetails(article.url);
                    setArticle(prev => ({
                        ...prev,
                        ...fullArticle
                    }));
                    onArticleUpdate(fullArticle);
                } catch (e) {
                    console.error("Failed to fetch full article details", e);
                }
            }
        };
        fetchFullArticle();
    }, [article.url, article.formattedContent]);

    // Update local state if initialArticle changes (e.g. from real-time parent updates)
    useEffect(() => {
        setArticle(prev => ({
            ...prev,
            ...initialArticle,
            // Keep the formattedContent if we fetched it recently and the parent doesn't have it
            formattedContent: hasMarkdownContent(prev.formattedContent) ? prev.formattedContent : initialArticle.formattedContent 
        }));
    }, [initialArticle]);

    // Fetch the database ID for this article to enable real-time subscriptions
    useEffect(() => {
        const fetchRowId = async () => {
            try {
                const { data } = await supabase
                    .from('public_news_articles')
                    .select('id')
                    .eq('article_data->>url', article.url)
                    .maybeSingle();
                
                if (data) {
                    setArticleRowId(data.id);
                }
            } catch (e) {
                console.error("Failed to fetch article ID for realtime updates", e);
            }
        };
        fetchRowId();
    }, [article.url]);

    // Subscribe to real-time updates for views/likes
    useEffect(() => {
        if (!articleRowId) return;

        const channel = supabase
            .channel(`article_stats_${articleRowId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'public_news_articles',
                    filter: `id=eq.${articleRowId}`,
                },
                (payload) => {
                    const newRecord = payload.new;
                    if (newRecord && newRecord.article_data) {
                        const rawContent = newRecord.formatted_content_md;
                        const updatedArticle: NewsArticle = {
                            ...(newRecord.article_data as NewsArticle),
                            category: newRecord.category,
                            formattedContent: typeof rawContent === 'string' ? { markdown: rawContent } : rawContent,
                            views: newRecord.views,
                            likes: newRecord.likes,
                            bookmarks: newRecord.bookmarks
                        };
                        onArticleUpdate(updatedArticle);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [articleRowId, onArticleUpdate]);

    const [followUpMessages, setFollowUpMessages] = useState<ChatMessage[]>([]);
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [isAnswering, setIsAnswering] = useState(false);
    const [isContentLoading, setIsContentLoading] = useState(false);
    const [followUpError, setFollowUpError] = useState<string | null>(null);
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);
    const [relatedArticles, setRelatedArticles] = useState<NewsArticle[]>([]);
    const [isLoadingRelated, setIsLoadingRelated] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    
    const isLiked = interactions[article.url]?.liked ?? false;

    const hostname = useMemo(() => {
        try {
            return new URL(article.url).hostname.replace(/^www\./, '');
        } catch {
            return 'the article website';
        }
    }, [article.url]);

    useEffect(() => {
        // Increment view count when article is opened
        const viewedKey = `viewed_${article.url}`;
        if (!sessionStorage.getItem(viewedKey)) {
            incrementStat(article.url, 'views', true);
            sessionStorage.setItem(viewedKey, 'true');
            // Update local article state and notify parent
            const updatedArticle = { ...article, views: (article.views || 0) + 1 };
            onArticleUpdate(updatedArticle);
        }
    }, [article.url]);

    useEffect(() => {
        const fetchRelated = async () => {
            setIsLoadingRelated(true);
            try {
                const allExploreCategories = ['technology', 'business', 'science', 'health', 'sports', 'entertainment'];
                const promises = allExploreCategories.map(cat => fetchNews(cat, true));
                const results = await Promise.allSettled(promises);
                
                const successfulResults = results
                    .filter((res): res is PromiseFulfilledResult<NewsArticle[]> => res.status === 'fulfilled')
                    .map(res => res.value);

                const flattenedArticles = successfulResults.flat();
                
                const randomArticles = flattenedArticles
                    .filter(a => a.url !== article.url)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 6);

                setRelatedArticles(randomArticles);
            } catch (e) {
                console.error("Failed to fetch related articles:", e);
                setRelatedArticles([]);
            } finally {
                setIsLoadingRelated(false);
            }
        };

        fetchRelated();
    }, [article.url]);


    useEffect(() => {
        setIsInitialLoading(true);
        const timer = setTimeout(() => {
            setIsInitialLoading(false);
        }, 750); 
        return () => clearTimeout(timer);
    }, [article.url]);

    useEffect(() => {
        const loadHistory = async () => {
            setIsHistoryLoading(true);
            setFollowUpMessages([]);
            setConversation(null);
            setIsFollowUpOpen(false);
            try {
                const existingConvo = await getArticleConversation(article.url, user);
                if (existingConvo) {
                    setConversation(existingConvo);
                    setFollowUpMessages(existingConvo.messages);
                    if (existingConvo.messages.length > 0) {
                        setIsFollowUpOpen(true);
                    }
                }
            } catch (e) {
                console.error("Failed to load article conversation history:", e);
            } finally {
                setIsHistoryLoading(false);
            }
        };
        loadHistory();
    }, [article.url, user?.id]);
    

    const handleAskFollowUp = useCallback(async () => {
        if (!followUpQuestion.trim() || isAnswering || isContentLoading) return;

        setFollowUpError(null);
        setIsFollowUpOpen(true);

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: followUpQuestion.trim(),
            timestamp: new Date().toISOString(),
        };
        const modelMessagePlaceholder: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'model',
            content: '',
            timestamp: new Date().toISOString(),
        };
        
        const newMessages = [...followUpMessages, userMessage];
        setFollowUpMessages([...newMessages, modelMessagePlaceholder]);
        setFollowUpQuestion('');
        
        let contentForAi: string | undefined;
        
        const cachedArticle = await getPublicArticleCache(article.url);
        if (cachedArticle?.content) {
            contentForAi = `Title: ${cachedArticle.title}\n\n${cachedArticle.content}`;
        } else {
            setIsContentLoading(true);
            try {
                const { title, content } = await fetchAndParseUrlContent(article.url);
                contentForAi = `Title: ${title}\n\n${content}`;
                if (user) { // Only authenticated users can write to the cache
                    savePublicArticleCache(article.url, title, content).catch(e => {
                        console.warn("Could not save to public article cache:", e);
                    });
                }
            } catch (fetchError: any) {
                setFollowUpError(`Could not fetch article content: ${fetchError.message}`);
                setIsContentLoading(false);
                setFollowUpMessages(newMessages); // Remove placeholder
                return;
            } finally {
                setIsContentLoading(false);
            }
        }
        
        setIsAnswering(true);
        const systemInstruction = `You are a helpful research assistant. Your primary task is to answer the user's question based on the provided [ARTICLE CONTENT] and the [PREVIOUS CONVERSATION HISTORY].

1.  **Analyze Context:** First, review the [PREVIOUS CONVERSATION HISTORY] to understand the ongoing discussion.
2.  **Prioritize Article Content:** Thoroughly analyze the [ARTICLE CONTENT] to find the answer. Your response should be structured using clear markdown (headings, lists, bold text).
3.  **Fallback to Google Search:** If the information is not in the provided content, or if the content is missing/empty, you MUST use the Google Search tool to find a current and accurate answer.
4.  **General Knowledge:** You may supplement your answer with your general knowledge, but clearly state when the information is not from the article or the web search.
5.  **Stay on Topic:** If the user's question is completely unrelated to the article's topic, politely decline and state that you can only answer related questions.`;

        const historyForPrompt = followUpMessages
            .slice(-8) // Take last 8 messages (4 turns) for context
            .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
            .join('\n');

        const prompt = `${systemInstruction}

[ARTICLE CONTENT]
---
${contentForAi || 'Content not available.'}
---
[END ARTICLE CONTENT]
${historyForPrompt ? `
[PREVIOUS CONVERSATION HISTORY]
---
${historyForPrompt}
---
[END HISTORY]
` : ''}
[CURRENT USER QUESTION]
${userMessage.content}
`;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("You must be logged in to ask follow-up questions.");
            }

            const clientApiKey = await getSetting<string>('kalina_api_key', user);

            const response = await fetch('/api/url-reader?action=follow-up', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ prompt, apiKey: clientApiKey })
            });

            if (!response.body) throw new Error("No response body from server");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullAnswer = '';
            let currentDisplayContent = '';
            let sources: GroundingChunk[] | undefined = undefined;
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') break;
                        if (!dataStr) continue;

                        let data;
                        try {
                            data = JSON.parse(dataStr);
                        } catch (parseError: any) {
                             // Ignore invalid JSON, it might be incomplete if the server sent a corrupted chunk,
                             // though this shouldn't happen with the buffer approach above.
                             continue;
                        }

                        if (data.error) {
                            throw new Error(data.error);
                        }

                        const chunkText = data.text;
                        if (data.sources) {
                            sources = data.sources;
                        }

                        fullAnswer += chunkText || '';

                        if (chunkText) {
                            const tokens = chunkText.match(/(\s+|\S+)/g) || [];
                        
                            for (const token of tokens) {
                                currentDisplayContent += token;
                                
                                setFollowUpMessages([...newMessages, { 
                                    ...modelMessagePlaceholder, 
                                    content: currentDisplayContent, 
                                    sources 
                                }]);
                                
                                const delay = (token.trim() === '') ? 5 : Math.max(10, 40 - (token.length * 2));
                                await new Promise(resolve => setTimeout(resolve, delay));
                            }
                        } else if (sources) {
                            setFollowUpMessages([...newMessages, { ...modelMessagePlaceholder, content: currentDisplayContent, sources }]);
                        }
                    }
                }
            }

            const finalMessages = [...newMessages, { ...modelMessagePlaceholder, content: fullAnswer }];
            
            const updatedConversationData: ArticleConversation = {
                ...(conversation || {
                    id: user ? crypto.randomUUID() : article.url,
                    article_url: article.url,
                    article_title: article.title,
                    createdAt: new Date().toISOString(),
                }),
                messages: finalMessages,
                updatedAt: new Date().toISOString(),
            };

            setConversation(updatedConversationData);
            await saveArticleConversation(updatedConversationData, user);

        } catch (err: any) {
            setFollowUpError(err.message || 'An error occurred while getting the answer.');
            setFollowUpMessages(newMessages); // Remove placeholder on error
            
            if (err.message && err.message.toLowerCase().includes('gemini api key')) {
                window.dispatchEvent(new CustomEvent('request-api-key'));
            }
        } finally {
            setIsAnswering(false);
        }
    }, [followUpQuestion, isAnswering, isContentLoading, article, followUpMessages, user, conversation]);

    const formatPublishedDate = (isoDate: string) => {
        const date = new Date(isoDate);
        return date.toLocaleString(undefined, {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };
    
    const handleLikeClick = () => {
        if (!isLiked) {
            setIsAnimating(true);
        }
        handleInteraction(article.url, 'like');
    };

    const isLoading = !hasMarkdownContent(article.formattedContent);

    return (
        <>
            <ReadingProgressBar scrollContainerRef={scrollRef} />
            <LikeAnimation animating={isAnimating} onAnimationEnd={() => setIsAnimating(false)} position="fixed" />
            <main ref={scrollRef} className="relative z-10 h-full overflow-y-auto p-4 md:p-6 pb-24 pt-20 md:pt-24 bg-[#F9F6F2] dark:bg-black">
                {isInitialLoading ? (
                    <div className="max-w-3xl mx-auto">
                        <SkeletonLoader />
                    </div>
                ) : (
                    <article className="max-w-3xl mx-auto">
                        <header className="mb-8 article-header">
                            <h1 className="mb-4">{article.title}</h1>
                            <div className="article-byline flex justify-between items-center gap-4 text-sm">
                                <div className="flex items-center gap-4">
                                    <span>By {article.author || article.source.name}</span>
                                    <span className="w-1 h-1 bg-neutral-400 rounded-full"></span>
                                    <span>{formatPublishedDate(article.publishedAt)}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <Eye className="h-4 w-4" />
                                        <span>{formatStat(article.views)}</span>
                                    </div>
                                    <button onClick={handleLikeClick} className="flex items-center gap-1.5 group">
                                        <Heart className={`h-4 w-4 transition-colors ${isLiked ? 'text-red-500 fill-current' : 'group-hover:text-red-400'}`} />
                                        <span>{formatStat(article.likes)}</span>
                                    </button>
                                </div>
                            </div>
                        </header>
                        
                        <figure className="mb-8">
                            <img
                                src={article.image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto-format&fit=crop'}
                                alt={article.title}
                                className="w-full h-auto max-h-[400px] object-cover rounded-lg shadow-lg"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto-format&fit=crop'; }}
                            />
                            <figcaption className="article-image-caption">
                                Image from {article.source.name}
                            </figcaption>
                        </figure>

                        {isLoading && <SkeletonLoader />}

                        {!isLoading && !hasMarkdownContent(article.formattedContent) && (
                            <div className="text-center py-16 px-4 bg-red-500/10 dark:bg-red-900/20 rounded-2xl border border-dashed border-red-500/30">
                                <WifiOff className="h-16 w-16 mx-auto text-red-500/70 mb-4" />
                                <h2 className="text-xl font-semibold text-red-700 dark:text-red-300">Could Not Load Formatted Article</h2>
                                <p className="mt-2 text-red-600 dark:text-red-400 max-w-md mx-auto">The pre-formatted content for this article is shown below.</p>
                            </div>
                        )}
                        
                        <div className="article-body">
                            <div className="prose-style">
                                <MarkdownRenderer content={getArticleMarkdown(article.formattedContent) || article.description || ''} />
                            </div>
                        </div>
                        
                        <footer className="mt-8 pt-6 border-t border-neutral-200 dark:border-gray-700">
                            <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                                View Original Source <ExternalLink className="h-4 w-4" />
                            </a>
                        </footer>
                        
                        {(isLoadingRelated || relatedArticles.length > 0) && (
                            <section className="mt-12 pt-8 border-t border-neutral-200 dark:border-gray-700">
                                <h2 className="text-2xl font-bold text-neutral-800 dark:text-gray-200 mb-6">Read Next</h2>
                                <div className="flex overflow-x-auto scrollbar-hide gap-4 pb-2 -mx-4 px-4">
                                    {isLoadingRelated ? (
                                        [...Array(6)].map((_, i) => <RelatedArticleCardSkeleton key={i} />)
                                    ) : (
                                        relatedArticles.map(relatedArticle => (
                                            <RelatedArticleCard 
                                                key={relatedArticle.url}
                                                article={relatedArticle}
                                                onClick={() => onReadArticle(relatedArticle)}
                                            />
                                        ))
                                    )}
                                </div>
                            </section>
                        )}
                    </article>
                )}
            </main>

            {user && !isHistoryLoading && (
                <FollowUpConversation
                    messages={followUpMessages}
                    isAnswering={isAnswering}
                    isContentLoading={isContentLoading}
                    followUpError={followUpError}
                    isFollowUpOpen={isFollowUpOpen}
                    setIsFollowUpOpen={setIsFollowUpOpen}
                    followUpQuestion={followUpQuestion}
                    setFollowUpQuestion={setFollowUpQuestion}
                    handleAskFollowUp={handleAskFollowUp}
                    hostname={hostname}
                />
            )}
        </>
    );
};

export default ArticleReaderView;
