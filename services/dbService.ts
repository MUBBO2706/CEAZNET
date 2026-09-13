




import { Conversation, UserProfile, ArticleConversation, UserArticleInteraction, Note, Transaction, FinanceProfile, Vehicle, DairyItem, DairyEntry, DairyPayment, GalleryItem, MoleculeViewerState, UserMolecule, MoleculeData } from '../types';
import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

const DB_NAME = 'CeaznetAppDB';
const DB_VERSION = 9; // Incremented for Translation History
const STORES = {
    CONVERSATIONS: 'conversations',
    SETTINGS: 'settings',
    USER_PROFILE: 'userProfile',
    TRANSLATOR_USAGE: 'translatorUsage',
    TRANSLATION_HISTORY: 'translation_history',
    ARTICLE_CONVERSATIONS: 'article_conversations',
    NOTES: 'notes',
    FINANCE: 'finance_transactions', 
    FINANCE_PROFILES: 'finance_profiles',
    VEHICLES: 'vehicles',
    DAIRY_ENTRIES: 'dairy_entries',
    DAIRY_PAYMENTS: 'dairy_payments',
    GALLERY_ITEMS: 'gallery_items',
    MOLECULES: 'user_molecules',
};

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach(storeName => {
          if (!dbInstance.objectStoreNames.contains(storeName)) {
              dbInstance.createObjectStore(storeName);
          }
      });
    };
  });
};

// This flag prevents the console from being spammed with the same network error.
let hasLoggedNetworkError = false;

/**
 * Custom error logger for Supabase errors to provide more detailed output.
 * It now detects and handles network errors gracefully.
 */
const logSupabaseError = (context: string, error: any) => {
    if (error) {
        // Specifically check for the 'Failed to fetch' network error.
        if (error.message && error.message.includes('Failed to fetch')) {
            if (!hasLoggedNetworkError) {
                console.error(
                    `[Supabase Error] A network error occurred, likely due to a connection issue, a paused Supabase project, or a CORS configuration problem. The app will fall back to local-only mode. Further Supabase network errors will be suppressed in the log for this session. Context of first failure: ${context}`,
                    error
                );
                hasLoggedNetworkError = true;
            }
            return; // Suppress logging for this error.
        }

        // Default logging for other types of Supabase errors.
        console.error(
            `[Supabase Error] ${context}:`,
            `\n  Message: ${error.message}`,
            `\n  Details: ${error.details}`,
            `\n  Hint: ${error.hint}`,
            `\n  Code: ${error.code}`,
            `\n  Full Error:`, error
        );
    }
};


// --- Local (IndexedDB) Providers ---

const getFromLocalDB = async <T>(storeName: string, key: IDBValidKey): Promise<T | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
    });
};

const getAllFromLocalDB = async <T>(storeName: string): Promise<T[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
    });
};

const saveToLocalDB = async <T>(storeName: string, value: T, key?: IDBValidKey): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

const deleteFromLocalDB = async (storeName: string, key: IDBValidKey): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// --- App-specific functions (Facade pattern) ---

export const getRecentConversation = async (user: User | null): Promise<Conversation | null> => {
    if (user) {
        const { data, error } = await supabase.from('conversations')
            .select('id, user_id, title, created_at, is_pinned, is_voice_conversation') // Do not select 'messages'
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') {
            logSupabaseError("Error fetching recent conversation", error);
            return null;
        }
        if (!data) return null;
        return {
            id: data.id,
            user_id: data.user_id,
            title: data.title,
            messages: [], // Optimised: didn't load messages
            createdAt: data.created_at,
            isPinned: data.is_pinned,
            isVoiceConversation: data.is_voice_conversation,
            isGeneratingTitle: false,
        };
    }
    const all = await getAllFromLocalDB<Conversation>(STORES.CONVERSATIONS);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
};

// Conversations
export const getConversations = async (user: User | null): Promise<Conversation[]> => {
    if (user) {
        const { data, error } = await supabase.from('conversations').select('*').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching Supabase conversations", error);
            return [];
        }
        return (data || []).map((convo): Conversation => ({
            id: convo.id,
            user_id: convo.user_id,
            title: convo.title,
            messages: convo.messages || [],
            createdAt: convo.created_at,
            isPinned: convo.is_pinned,
            isVoiceConversation: convo.is_voice_conversation,
            audio_url: convo.audio_url,
            isGeneratingTitle: false, // This is a transient UI state
        }));
    }
    return getAllFromLocalDB<Conversation>(STORES.CONVERSATIONS);
};
export const saveConversation = async (convo: Conversation, user: User | null) => {
    if (user) {
        // Omit transient UI state properties before saving
        const { isGeneratingTitle, ...convoToSave } = convo;
        const dataToUpsert = {
            id: convoToSave.id,
            user_id: user.id,
            owner: user.id, // Fallback for backward compatibility if owner column is NOT NULL
            created_at: convoToSave.createdAt,
            title: convoToSave.title,
            messages: convoToSave.messages,
            is_pinned: convoToSave.isPinned,
            is_voice_conversation: convoToSave.isVoiceConversation,
            audio_url: convoToSave.audio_url,
        };
        const { error } = await supabase.from('conversations').upsert(dataToUpsert);
        if (error) logSupabaseError("Error saving Supabase conversation", error);
    } else {
        await saveToLocalDB(STORES.CONVERSATIONS, convo, convo.id);
    }
};
export const deleteConversation = async (id: string, user: User | null) => {
    // Fetch the conversation first to check for an audio_url
    let audioUrlToDelete: string | null = null;
    if (user) {
        const { data, error } = await supabase.from('conversations').select('audio_url').eq('id', id).maybeSingle();
        if (!error && data) {
            audioUrlToDelete = data.audio_url;
        }
    } else {
        const localConvo = await getFromLocalDB<any>(STORES.CONVERSATIONS, id);
        if (localConvo) {
            audioUrlToDelete = localConvo.audio_url;
        }
    }

    // Delete from Telegram if it's a Telegram URL
    if (audioUrlToDelete && audioUrlToDelete.startsWith('tg://')) {
        try {
            const { deleteFileFromTelegram } = await import('./telegramStorage');
            await deleteFileFromTelegram(audioUrlToDelete);
        } catch (err) {
            console.error('Failed to delete audio from Telegram:', err);
        }
    }

    if (user) {
        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (error) {
            logSupabaseError("Error deleting Supabase conversation", error);
            throw error; // Re-throw to allow caller to handle
        }
    } else {
        await deleteFromLocalDB(STORES.CONVERSATIONS, id);
    }
};

// Settings are stored in a single row per user in Supabase
interface UserSettings {
  [key: string]: any;
}
const getSupabaseSettings = async (user: User): Promise<UserSettings> => {
    // Basic in-memory cache to prevent multiple parallel fetches during same render cycle
    if ((window as any)._settingsCachePromise && (window as any)._settingsCacheUser === user.id) {
        return (window as any)._settingsCachePromise;
    }
    const fetchPromise = supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') logSupabaseError("Error fetching remote settings", error);
        return data || {};
    });
    (window as any)._settingsCachePromise = fetchPromise;
    (window as any)._settingsCacheUser = user.id;
    return fetchPromise;
};

// Generic Settings (API Key, voice settings, etc.)
export const getSetting = async <T>(key: string, user: User | null): Promise<T | undefined> => {
    if (user) {
        const settings = await getSupabaseSettings(user);
        const keyMapping: Record<string, string> = { 'ceaznet_api_key': 'api_key', 'ceaznet_voice_mode_voice': 'voice_mode_voice', 'ceaznet_voice_mode_persona_instruction': 'voice_mode_persona_instruction', 'ceaznet_voice_mode_tone_instruction': 'voice_mode_tone_instruction', 'ceaznet_voice_mode_custom_instruction': 'voice_mode_custom_instruction', 'ceaznet_voice_proactive_mode': 'voice_proactive_mode', 'ceaznet_voice_recording_enabled': 'voice_recording_enabled', 'ceaznet_voice_personas': 'voice_personas', 'ceaznet_voice_persona': 'voice_persona' };
        return settings[keyMapping[key]] as T;
    }
    return getFromLocalDB<T>(STORES.SETTINGS, key);
};
export const saveSetting = async (key: string, value: any, user: User | null) => {
    if (user) {
        const keyMapping: Record<string, string> = { 'ceaznet_api_key': 'api_key', 'ceaznet_voice_mode_voice': 'voice_mode_voice', 'ceaznet_voice_mode_persona_instruction': 'voice_mode_persona_instruction', 'ceaznet_voice_mode_tone_instruction': 'voice_mode_tone_instruction', 'ceaznet_voice_mode_custom_instruction': 'voice_mode_custom_instruction', 'ceaznet_voice_proactive_mode': 'voice_proactive_mode', 'ceaznet_voice_recording_enabled': 'voice_recording_enabled', 'ceaznet_voice_personas': 'voice_personas', 'ceaznet_voice_persona': 'voice_persona' };
        const columnName = keyMapping[key];
        if (!columnName) return;
        
        const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, [columnName]: value, updated_at: new Date() });
        if (error) logSupabaseError("Error saving remote setting", error);
    } else {
        await saveToLocalDB(STORES.SETTINGS, value, key);
    }
};

export const saveMultipleSettings = async (settings: Record<string, any>, user: User | null) => {
    if (user) {
        const keyMapping: Record<string, string> = { 'ceaznet_api_key': 'api_key', 'ceaznet_voice_mode_voice': 'voice_mode_voice', 'ceaznet_voice_mode_persona_instruction': 'voice_mode_persona_instruction', 'ceaznet_voice_mode_tone_instruction': 'voice_mode_tone_instruction', 'ceaznet_voice_mode_custom_instruction': 'voice_mode_custom_instruction', 'ceaznet_voice_proactive_mode': 'voice_proactive_mode', 'ceaznet_voice_recording_enabled': 'voice_recording_enabled', 'ceaznet_voice_personas': 'voice_personas', 'ceaznet_voice_persona': 'voice_persona' };
        
        const payload: Record<string, any> = { user_id: user.id, updated_at: new Date() };
        for (const [key, value] of Object.entries(settings)) {
            const columnName = keyMapping[key];
            if (columnName) {
                payload[columnName] = value;
            }
        }
        
        const { error } = await supabase.from('user_settings').upsert(payload);
        if (error) logSupabaseError("Error saving remote settings batch", error);
    } else {
        for (const [key, value] of Object.entries(settings)) {
            await saveToLocalDB(STORES.SETTINGS, value, key);
        }
    }
};

// Article Conversations Cache and Request Coalescing
const articleConvoCache = new Map<string, { data: ArticleConversation | undefined; timestamp: number }>();
const articleConvoPending = new Map<string, Promise<ArticleConversation | undefined>>();

const publicArticleCacheStore = new Map<string, { data: { title: string; content: string } | null; timestamp: number }>();
const publicArticleCachePending = new Map<string, Promise<{ title: string; content: string } | null>>();

const interactionsCache = new Map<string, { data: UserArticleInteraction; timestamp: number }>();
const interactionsPending = new Map<string, Promise<any>>();

// Article Conversations
export const getArticleConversation = async (articleUrl: string, user: User | null): Promise<ArticleConversation | undefined> => {
    if (!user) {
        return getFromLocalDB<ArticleConversation>(STORES.ARTICLE_CONVERSATIONS, articleUrl);
    }

    const key = `${user.id}:${articleUrl}`;
    const cached = articleConvoCache.get(key);
    const CACHE_TTL = 30000; // 30 seconds
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    if (articleConvoPending.has(key)) {
        return articleConvoPending.get(key);
    }

    const promise = (async () => {
        try {
            const { data, error } = await supabase
                .from('article_conversations')
                .select('*')
                .eq('user_id', user.id)
                .eq('article_url', articleUrl)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') {
                logSupabaseError("Error fetching remote article conversation", error);
                return undefined;
            }
            const res = data ? {
                id: data.id,
                user_id: data.user_id,
                article_url: data.article_url,
                article_title: data.article_title,
                messages: data.messages || [],
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            } : undefined;

            articleConvoCache.set(key, { data: res, timestamp: Date.now() });
            return res;
        } catch (err) {
            console.error("Failed to fetch article conversation", err);
            return undefined;
        } finally {
            articleConvoPending.delete(key);
        }
    })();

    articleConvoPending.set(key, promise);
    return promise;
};

export const saveArticleConversation = async (convo: ArticleConversation, user: User | null) => {
    if (user) {
        const key = `${user.id}:${convo.article_url}`;
        articleConvoCache.set(key, { data: convo, timestamp: Date.now() });

        const { error } = await supabase.from('article_conversations').upsert({
            user_id: user.id,
            article_url: convo.article_url,
            article_title: convo.article_title,
            messages: convo.messages,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id, article_url' });
        if (error) logSupabaseError("Error saving remote article conversation", error);
    } else {
        await saveToLocalDB(STORES.ARTICLE_CONVERSATIONS, convo, convo.article_url);
    }
};

// Public Article Cache
export const getPublicArticleCache = async (articleUrl: string): Promise<{ title: string; content: string } | null> => {
    const cached = publicArticleCacheStore.get(articleUrl);
    const CACHE_TTL = 60000; // 1 minute cache
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    if (publicArticleCachePending.has(articleUrl)) {
        return publicArticleCachePending.get(articleUrl)!;
    }

    const promise = (async () => {
        try {
            const { data, error } = await supabase
                .from('public_article_cache')
                .select('title, content')
                .eq('article_url', articleUrl)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') {
                logSupabaseError("Error fetching public article cache", error);
                return null;
            }
            publicArticleCacheStore.set(articleUrl, { data, timestamp: Date.now() });
            return data;
        } catch (err) {
            console.error("Failed to fetch public article cache", err);
            return null;
        } finally {
            publicArticleCachePending.delete(articleUrl);
        }
    })();

    publicArticleCachePending.set(articleUrl, promise);
    return promise;
};

export const savePublicArticleCache = async (articleUrl: string, title: string, content: string): Promise<void> => {
    publicArticleCacheStore.set(articleUrl, { data: { title, content }, timestamp: Date.now() });
    const { error } = await supabase
        .from('public_article_cache')
        .upsert({
            article_url: articleUrl,
            title: title,
            content: content,
        }, { onConflict: 'article_url', ignoreDuplicates: true });
    if (error) { 
        logSupabaseError("Error saving public article cache", error);
    }
};

// Article Interactions
const ANON_INTERACTIONS_KEY = 'ceaznet_anon_interactions';

const getLocalInteractions = (articleUrls: string[]): UserArticleInteraction[] => {
    try {
        const stored = localStorage.getItem(ANON_INTERACTIONS_KEY);
        if (!stored) return [];
        const allInteractions: Record<string, { liked: boolean; bookmarked: boolean }> = JSON.parse(stored);
        return articleUrls
            .filter(url => allInteractions[url])
            .map(url => ({ article_url: url, ...allInteractions[url] }));
    } catch {
        return [];
    }
};

const saveLocalInteraction = (interaction: UserArticleInteraction) => {
    try {
        const stored = localStorage.getItem(ANON_INTERACTIONS_KEY);
        const allInteractions = stored ? JSON.parse(stored) : {};
        allInteractions[interaction.article_url] = {
            liked: interaction.liked,
            bookmarked: interaction.bookmarked,
        };
        localStorage.setItem(ANON_INTERACTIONS_KEY, JSON.stringify(allInteractions));
    } catch (e) {
        console.error("Failed to save local interaction", e);
    }
};

export const getBookmarkCount = async (user: User | null): Promise<number> => {
    if (user) {
        const { count, error } = await supabase
            .from('user_article_interactions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('bookmarked', true);
        
        if (error) {
            logSupabaseError("Error fetching bookmark count", error);
            return 0;
        }
        return count || 0;
    } else {
        const stored = localStorage.getItem(ANON_INTERACTIONS_KEY);
        if (!stored) return 0;
        const allInteractions: Record<string, { liked: boolean; bookmarked: boolean }> = JSON.parse(stored);
        return Object.values(allInteractions).filter(i => i.bookmarked).length;
    }
};

const pendingUrlPromises = new Map<string, Promise<UserArticleInteraction>>();

export const getInteractions = async (user: User | null, articleUrls: string[]): Promise<UserArticleInteraction[]> => {
    if (!user) {
        return getLocalInteractions(articleUrls);
    }
    if (articleUrls.length === 0) {
        return [];
    }

    const CACHE_TTL = 30000; // 30 seconds TTL for interactions
    const results: UserArticleInteraction[] = [];
    const urlsToFetch: string[] = [];
    const promisesToWait: Promise<UserArticleInteraction>[] = [];

    for (const url of articleUrls) {
        const key = `${user.id}:${url}`;
        const cached = interactionsCache.get(key);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            results.push(cached.data);
        } else if (pendingUrlPromises.has(key)) {
            promisesToWait.push(pendingUrlPromises.get(key)!);
        } else {
            urlsToFetch.push(url);
        }
    }

    if (urlsToFetch.length > 0) {
        const uniqueUrls = Array.from(new Set(urlsToFetch));
        
        let batchResolve: (value: Map<string, UserArticleInteraction>) => void;
        const batchPromise = new Promise<Map<string, UserArticleInteraction>>((resolve) => {
            batchResolve = resolve;
        });

        for (const url of uniqueUrls) {
            const key = `${user.id}:${url}`;
            const urlPromise = batchPromise.then(map => map.get(url) || { article_url: url, liked: false, bookmarked: false });
            pendingUrlPromises.set(key, urlPromise);
            promisesToWait.push(urlPromise);
        }

        (async () => {
            try {
                const { data, error } = await supabase
                    .from('user_article_interactions')
                    .select('article_url, liked, bookmarked')
                    .in('article_url', uniqueUrls)
                    .eq('user_id', user.id);
                
                const fetchedMap = new Map<string, UserArticleInteraction>();
                if (!error && data) {
                    for (const item of data as UserArticleInteraction[]) {
                        fetchedMap.set(item.article_url, item);
                        const key = `${user.id}:${item.article_url}`;
                        interactionsCache.set(key, { data: item, timestamp: Date.now() });
                    }
                }

                for (const url of uniqueUrls) {
                    if (!fetchedMap.has(url)) {
                        const defaultInter = { article_url: url, liked: false, bookmarked: false };
                        fetchedMap.set(url, defaultInter);
                        const key = `${user.id}:${url}`;
                        interactionsCache.set(key, { data: defaultInter, timestamp: Date.now() });
                    }
                }

                batchResolve!(fetchedMap);
            } catch (err) {
                const fallbackMap = new Map<string, UserArticleInteraction>();
                for (const url of uniqueUrls) {
                    fallbackMap.set(url, { article_url: url, liked: false, bookmarked: false });
                }
                batchResolve!(fallbackMap);
            } finally {
                for (const url of uniqueUrls) {
                    pendingUrlPromises.delete(`${user.id}:${url}`);
                }
            }
        })();
    }

    if (promisesToWait.length > 0) {
        const awaitedResults = await Promise.all(promisesToWait);
        results.push(...awaitedResults);
    }

    const finalMap = new Map<string, UserArticleInteraction>();
    for (const item of results) {
        finalMap.set(item.article_url, item);
    }
    return Array.from(finalMap.values());
};

export const saveInteraction = async (user: User | null, interaction: UserArticleInteraction) => {
    if (user) {
        const key = `${user.id}:${interaction.article_url}`;
        interactionsCache.set(key, { data: interaction, timestamp: Date.now() });

        const { error } = await supabase
            .from('user_article_interactions')
            .upsert({ ...interaction, user_id: user.id }, { onConflict: 'user_id, article_url' });
        if (error) logSupabaseError("Error saving article interaction", error);
    } else {
        saveLocalInteraction(interaction);
    }
};

export const incrementStat = async (articleUrl: string, stat: 'views' | 'likes' | 'bookmarks', increment: boolean) => {
    try {
        const { error } = await supabase.functions.invoke('update-article-stats', {
            body: { article_url: articleUrl, stat, increment },
        });
        if (error) throw error;
    } catch (e) {
        console.error(`Failed to increment stat '${stat}' for article ${articleUrl}`, e);
    }
};

export const getArticleStats = async (articleUrl: string): Promise<{ views: number; likes: number; bookmarks: number } | null> => {
    try {
        const { data, error } = await supabase
            .from('public_news_articles')
            .select('views, likes, bookmarks')
            .eq('article_data->>url', articleUrl)
            .maybeSingle();

        if (error) {
            if (error.code !== 'PGRST116') {
                console.error("Error fetching article stats", error);
            }
            return null;
        }

        return {
            views: data?.views || 0,
            likes: data?.likes || 0,
            bookmarks: data?.bookmarks || 0
        };
    } catch (e) {
        console.error("Failed to get article stats", e);
        return null;
    }
};

// --- NOTES CACHING ---
let cachedNotesPromise: Promise<Note[]> | null = null;
let cachedNotesUserId: string | null = null;

interface CachedSingleNote {
    note: Note;
    timestamp: number;
}
const singleNoteCache = new Map<string, CachedSingleNote>();
const SINGLE_NOTE_TTL = 10 * 60 * 1000; // 10 minutes TTL

export const clearNotesCache = () => {
    cachedNotesPromise = null;
};

export const invalidateNoteCache = (id?: string) => {
    cachedNotesPromise = null;
    if (id) {
        singleNoteCache.delete(id);
    } else {
        singleNoteCache.clear();
    }
};

// --- NOTES ---
export const getNotes = async (user: User | null): Promise<Note[]> => {
    if (user) {
        if (cachedNotesPromise && cachedNotesUserId === user.id) {
            return cachedNotesPromise;
        }
        
        cachedNotesUserId = user.id;
        cachedNotesPromise = (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                
                const response = await fetch('/api/db/query?q=fetch_notes', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        table: 'notes',
                        select: 'id, user_id, title, content, tags, is_pinned, color_theme, created_at, updated_at',
                        eq: { user_id: user.id },
                        truncateField: 'content',
                        truncateLength: 50
                    })
                });
                if (!response.ok) throw new Error("Failed to fetch notes via proxy");
                const { data } = await response.json();
                return (data || []).map((note: any): Note => {
                    return {
                        id: note.id,
                        user_id: note.user_id,
                        title: note.title,
                        content: note.content || '',
                        tags: note.tags || [],
                        isPinned: note.is_pinned,
                        colorTheme: note.color_theme,
                        createdAt: note.created_at,
                        updatedAt: note.updated_at,
                    };
                });
            } catch (error) {
                logSupabaseError("Error fetching notes via proxy, falling back to direct query", error);
                try {
                    // Direct Supabase fallback to ensure user always sees their notes
                    const { data, error: directError } = await supabase
                        .from('notes')
                        .select('id, user_id, title, content, tags, is_pinned, color_theme, created_at, updated_at')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });

                    if (!directError && data) {
                        return data.map((note: any): Note => ({
                            id: note.id,
                            user_id: note.user_id,
                            title: note.title,
                            content: note.content || '',
                            tags: note.tags || [],
                            isPinned: note.is_pinned,
                            colorTheme: note.color_theme,
                            createdAt: note.created_at,
                            updatedAt: note.updated_at,
                        }));
                    }
                } catch (fallbackErr) {
                    logSupabaseError("Direct notes fetch fallback also failed", fallbackErr);
                }
                cachedNotesPromise = null; // Invalidate on error
                return [];
            }
        })();
        
        return cachedNotesPromise;
    }
    const local = await getAllFromLocalDB<Note>(STORES.NOTES);
    return local;
};

export const getNoteById = async (id: string, user: User | null, forceRefresh = false): Promise<Note | null> => {
    if (user) {
        if (!forceRefresh) {
            const cached = singleNoteCache.get(id);
            if (cached && (Date.now() - cached.timestamp < SINGLE_NOTE_TTL)) {
                return cached.note;
            }
        }

        const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
        if (error || !data) return null;
        const note: Note = {
            id: data.id,
            user_id: data.user_id,
            title: data.title,
            content: data.content,
            tags: data.tags || [],
            isPinned: data.is_pinned,
            colorTheme: data.color_theme,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
        singleNoteCache.set(id, { note, timestamp: Date.now() });
        return note;
    }
    return getFromLocalDB<Note>(STORES.NOTES, id);
};

export const getPublicSharedNote = async (id: string, exp?: string | null, sig?: string | null): Promise<Note | null> => {
    try {
        let url = `/api/notes/shared?id=${encodeURIComponent(id)}`;
        if (exp) {
            url += `&exp=${encodeURIComponent(exp)}`;
        }
        if (sig) {
            url += `&sig=${encodeURIComponent(sig)}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            if (errJson.error) {
                throw new Error(errJson.error);
            }
            return null;
        }
        const json = await response.json();
        if (json.success && json.note) {
            return json.note;
        }
        return null;
    } catch (error: any) {
        console.error("Failed to fetch public shared note", error);
        if (error.message && error.message.includes('expired')) {
            throw error;
        }
        return null;
    }
};

export const getRecentNotes = async (user: User | null, limit: number): Promise<Note[]> => {
    const allNotes = await getNotes(user);
    return [...allNotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
};

export const saveNote = async (note: Note, user: User | null) => {
    singleNoteCache.set(note.id, { note, timestamp: Date.now() });
    if (user) {
        const { error } = await supabase.from('notes').upsert({
            id: note.id,
            user_id: user.id,
            title: note.title,
            content: note.content,
            tags: note.tags,
            is_pinned: note.isPinned,
            color_theme: note.colorTheme,
            created_at: note.createdAt,
            updated_at: note.updatedAt,
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving note", error);
        
        fetch('/api/db/clear-cache?q=clear_notes_save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'notes' })
        }).catch(() => {});

        clearNotesCache();
        await saveToLocalDB(STORES.NOTES, note, note.id).catch(() => {});
    } else {
        await saveToLocalDB(STORES.NOTES, note, note.id);
    }
};

export const deleteNote = async (id: string, user: User | null) => {
    singleNoteCache.delete(id);
    if (user) {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting note", error);
        
        fetch('/api/db/clear-cache?q=clear_notes_delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table: 'notes' })
        }).catch(() => {});

        clearNotesCache();
        await deleteFromLocalDB(STORES.NOTES, id).catch(() => {});
    } else {
        await deleteFromLocalDB(STORES.NOTES, id);
    }
};

// --- IN-MEMORY CACHES & PROMISE COALESCING ---
const CACHE_TTL_30S = 30000;

let financeProfilesCache: { user_id: string; data: FinanceProfile[]; timestamp: number } | null = null;
const financeProfilesPending = new Map<string, Promise<FinanceProfile[]>>();

export const invalidateFinanceProfilesCache = () => {
    financeProfilesCache = null;
};

const financeTransactionsCache = new Map<string, { data: any; timestamp: number }>();
const financeTransactionsPending = new Map<string, Promise<any>>();

const walletCountsCache = new Map<string, { data: Record<string, number>; timestamp: number }>();
const walletCountsPending = new Map<string, Promise<Record<string, number>>>();

const financeSummaryCache = new Map<string, { data: any; timestamp: number }>();
const financeSummaryPending = new Map<string, Promise<any>>();
const financeStatsCache = new Map<string, { data: any; timestamp: number }>();
const financeStatsPending = new Map<string, Promise<any>>();
const financeAnalyticsCache = new Map<string, { data: any; timestamp: number }>();
const financeAnalyticsPending = new Map<string, Promise<any>>();

export const invalidateFinanceTransactionsCache = () => {
    financeTransactionsCache.clear();
    financeTransactionsPending.clear();
    walletCountsCache.clear();
    walletCountsPending.clear();
    financeSummaryCache.clear();
    financeSummaryPending.clear();
    financeStatsCache.clear();
    financeStatsPending.clear();
    financeAnalyticsCache.clear();
    financeAnalyticsPending.clear();
};

let dairyItemsCache: { user_id: string; data: DairyItem[]; timestamp: number } | null = null;
const dairyItemsPending = new Map<string, Promise<DairyItem[]>>();

let dairyEntriesCache: { user_id: string; data: DairyEntry[]; timestamp: number } | null = null;
const dairyEntriesPending = new Map<string, Promise<DairyEntry[]>>();

let dairyPaymentsCache: { user_id: string; data: DairyPayment[]; timestamp: number } | null = null;
const dairyPaymentsPending = new Map<string, Promise<DairyPayment[]>>();

export const invalidateDairyCache = () => {
    dairyItemsCache = null;
    dairyEntriesCache = null;
    dairyPaymentsCache = null;
};

// --- FINANCE PROFILES ---
export const getFinanceProfiles = async (user: User | null): Promise<FinanceProfile[]> => {
    if (!user) {
        return getAllFromLocalDB<FinanceProfile>(STORES.FINANCE_PROFILES);
    }

    const userId = user.id;
    if (financeProfilesCache && financeProfilesCache.user_id === userId && (Date.now() - financeProfilesCache.timestamp < CACHE_TTL_30S)) {
        return financeProfilesCache.data;
    }

    if (financeProfilesPending.has(userId)) {
        return financeProfilesPending.get(userId)!;
    }

    const promise = (async () => {
        try {
            const { data, error } = await supabase.from('finance_profiles').select('*').eq('user_id', userId);
            if (error) {
                logSupabaseError("Error fetching finance profiles", error);
                return [];
            }
            const res = (data || []).map((p): FinanceProfile => ({
                id: p.id,
                user_id: p.user_id,
                name: p.name,
                type: p.type,
                currency: p.currency,
                created_at: p.created_at,
            }));
            financeProfilesCache = { user_id: userId, data: res, timestamp: Date.now() };
            return res;
        } finally {
            financeProfilesPending.delete(userId);
        }
    })();

    financeProfilesPending.set(userId, promise);
    return promise;
};

export const saveFinanceProfile = async (profile: FinanceProfile, user: User | null) => {
    invalidateFinanceProfilesCache();
    if (user) {
        const { error } = await supabase.from('finance_profiles').upsert({
            id: profile.id,
            user_id: user.id,
            name: profile.name,
            type: profile.type,
            currency: profile.currency,
            created_at: profile.created_at,
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving finance profile", error);
    } else {
        await saveToLocalDB(STORES.FINANCE_PROFILES, profile, profile.id);
    }
};

export const updateFinanceProfile = async (id: string, name: string, user: User | null) => {
    invalidateFinanceProfilesCache();
    if (user) {
        const { error } = await supabase.from('finance_profiles').update({ name }).eq('id', id);
        if (error) logSupabaseError("Error updating finance profile", error);
    } else {
        const profile = await getFromLocalDB<FinanceProfile>(STORES.FINANCE_PROFILES, id);
        if (profile) {
            profile.name = name;
            await saveToLocalDB(STORES.FINANCE_PROFILES, profile, id);
        }
    }
}

export const deleteFinanceProfile = async (id: string, user: User | null) => {
    invalidateFinanceProfilesCache();
    if (user) {
        const { error } = await supabase.from('finance_profiles').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting finance profile", error);
    } else {
        await deleteFromLocalDB(STORES.FINANCE_PROFILES, id);
    }
};

// --- Custom Categories Persistence ---
export interface CustomCategoryItem {
    id: string;
    label: string;
    type: 'expense' | 'income' | 'transfer';
    iconName: string;
    color?: string;
    bg?: string;
    isCustom?: boolean;
    created_at?: string;
}

export const getCustomCategories = async (user: User | null): Promise<CustomCategoryItem[]> => {
    try {
        if (user) {
            const metaCats = user.user_metadata?.custom_categories;
            if (Array.isArray(metaCats) && metaCats.length > 0) {
                await saveToLocalDB(STORES.SETTINGS, metaCats, 'custom_categories');
                return metaCats;
            }
        }
        const local = await getFromLocalDB<CustomCategoryItem[]>(STORES.SETTINGS, 'custom_categories');
        return Array.isArray(local) ? local : [];
    } catch (e) {
        console.error("Error fetching custom categories:", e);
        const local = await getFromLocalDB<CustomCategoryItem[]>(STORES.SETTINGS, 'custom_categories');
        return Array.isArray(local) ? local : [];
    }
};

export const saveCustomCategory = async (cat: CustomCategoryItem, user: User | null): Promise<CustomCategoryItem[]> => {
    try {
        const existing = await getCustomCategories(user);
        const filtered = existing.filter(c => c.id.toLowerCase() !== cat.id.toLowerCase());
        const updated = [...filtered, cat];

        await saveToLocalDB(STORES.SETTINGS, updated, 'custom_categories');

        if (user) {
            try {
                const { error } = await supabase.auth.updateUser({
                    data: { custom_categories: updated }
                });
                if (error) {
                    console.error("Error saving custom categories to Supabase user_metadata:", error);
                }
            } catch (err) {
                console.warn("Failed to sync custom category to Supabase user_metadata:", err);
            }
        }

        return updated;
    } catch (e) {
        console.error("Error saving custom category:", e);
        return [];
    }
};

export const deleteCustomCategory = async (categoryId: string, user: User | null): Promise<CustomCategoryItem[]> => {
    try {
        const existing = await getCustomCategories(user);
        const updated = existing.filter(c => c.id.toLowerCase() !== categoryId.toLowerCase());

        await saveToLocalDB(STORES.SETTINGS, updated, 'custom_categories');

        if (user) {
            try {
                await supabase.auth.updateUser({
                    data: { custom_categories: updated }
                });
            } catch (err) {
                console.warn("Failed to sync custom category deletion to Supabase user_metadata:", err);
            }
        }

        return updated;
    } catch (e) {
        console.error("Error deleting custom category:", e);
        return [];
    }
};

export const getHiddenCategories = async (user: User | null): Promise<string[]> => {
    try {
        if (user) {
            const userMeta = user.user_metadata;
            if (userMeta && Array.isArray(userMeta.hidden_categories)) {
                return userMeta.hidden_categories;
            }
        }
        const local = await getFromLocalDB<string[]>(STORES.SETTINGS, 'hidden_categories');
        return Array.isArray(local) ? local : [];
    } catch (e) {
        console.error("Error fetching hidden categories:", e);
        return [];
    }
};

export const hideCategory = async (categoryId: string, user: User | null): Promise<string[]> => {
    try {
        const existing = await getHiddenCategories(user);
        const lower = categoryId.toLowerCase();
        if (!existing.some(c => c.toLowerCase() === lower)) {
            const updated = [...existing, categoryId];
            await saveToLocalDB(STORES.SETTINGS, updated, 'hidden_categories');
            if (user) {
                try {
                    await supabase.auth.updateUser({
                        data: { hidden_categories: updated }
                    });
                } catch (err) {
                    console.warn("Failed to sync hidden category to Supabase user_metadata:", err);
                }
            }
            return updated;
        }
        return existing;
    } catch (e) {
        console.error("Error hiding category:", e);
        return [];
    }
};

export const unhideCategory = async (categoryId: string, user: User | null): Promise<string[]> => {
    try {
        const existing = await getHiddenCategories(user);
        const updated = existing.filter(c => c.toLowerCase() !== categoryId.toLowerCase());
        await saveToLocalDB(STORES.SETTINGS, updated, 'hidden_categories');
        if (user) {
            try {
                await supabase.auth.updateUser({
                    data: { hidden_categories: updated }
                });
            } catch (err) {
                console.warn("Failed to sync unhiding category to Supabase user_metadata:", err);
            }
        }
        return updated;
    } catch (e) {
        console.error("Error unhiding category:", e);
        return [];
    }
};

export interface CategoryUsageImpact {
    categoryId: string;
    count: number;
    totalAmount: number;
    transactions: Transaction[];
    uniqueProfilesCount: number;
}

export const getCategoryUsageImpact = async (categoryId: string, user: User | null): Promise<CategoryUsageImpact> => {
    try {
        const allTransactions = await getTransactions(user, undefined);
        const targetLower = categoryId.toLowerCase().trim();
        const affected = allTransactions.filter(t => (t.category || '').toLowerCase().trim() === targetLower);
        
        const count = affected.length;
        const totalAmount = affected.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const uniqueProfiles = new Set(affected.map(t => t.profile_id || 'default')).size;

        return {
            categoryId,
            count,
            totalAmount,
            transactions: affected,
            uniqueProfilesCount: uniqueProfiles
        };
    } catch (e) {
        console.error("Error getting category usage impact:", e);
        return {
            categoryId,
            count: 0,
            totalAmount: 0,
            transactions: [],
            uniqueProfilesCount: 0
        };
    }
};

export const reassignCategoryTransactions = async (
    fromCategory: string,
    toCategory: string,
    user: User | null
): Promise<{ updatedCount: number; affectedTransactions: Transaction[] }> => {
    try {
        const allTransactions = await getTransactions(user, undefined);
        const targetLower = fromCategory.toLowerCase().trim();
        const affected = allTransactions.filter(t => (t.category || '').toLowerCase().trim() === targetLower);

        if (affected.length === 0) {
            return { updatedCount: 0, affectedTransactions: [] };
        }

        const updatedTransactions: Transaction[] = affected.map(t => ({
            ...t,
            category: toCategory
        }));

        await saveTransactionsBulk(updatedTransactions, user);
        invalidateFinanceTransactionsCache();

        return {
            updatedCount: updatedTransactions.length,
            affectedTransactions: updatedTransactions
        };
    } catch (e) {
        console.error("Error reassigning category transactions:", e);
        throw e;
    }
};

// --- VEHICLE MANAGEMENT ---
export const getVehicles = async (user: User | null): Promise<Vehicle[]> => {
    if (user) {
        const { data, error } = await supabase.from('vehicles').select('*').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching vehicles", error);
            return [];
        }
        return (data || []).map((v): Vehicle => ({
            id: v.id,
            user_id: v.user_id,
            name: v.name,
            type: v.type,
            number_plate: v.number_plate,
            current_odometer: v.current_odometer,
        }));
    }
    return getAllFromLocalDB<Vehicle>(STORES.VEHICLES);
}

export const saveVehicle = async (vehicle: Vehicle, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('vehicles').upsert({
            id: vehicle.id,
            user_id: user.id,
            name: vehicle.name,
            type: vehicle.type,
            number_plate: vehicle.number_plate,
            current_odometer: vehicle.current_odometer,
            created_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving vehicle", error);
    } else {
        await saveToLocalDB(STORES.VEHICLES, vehicle, vehicle.id);
    }
}

export const deleteVehicle = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('vehicles').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting vehicle", error);
    } else {
        await deleteFromLocalDB(STORES.VEHICLES, id);
    }
}

export const DEFAULT_WALLET_UUID = '00000000-0000-0000-0000-000000000000';

// --- FINANCE TRANSACTIONS ---
export const getFinanceSummary = async (
    user: User | null,
    profileId?: string | null
): Promise<{ balance: number, income: number, expense: number, count: number, lastTransaction: Transaction | null }> => {
    // Resolution logic:
    // 1. If profileId === 'all': user explicitly requested all wallets.
    // 2. If profileId is specified (UUID string, 'default', or null): use it directly.
    // 3. If profileId is undefined (e.g. initial load): resolve user's selected wallet from localStorage.
    //    If none or 'default', target the default wallet (DEFAULT_WALLET_UUID), NEVER mixing all wallets.
    let effectiveProfileId = profileId;
    if (effectiveProfileId === undefined) {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('ceaznet_active_wallet_id');
            if (saved && saved !== 'default') {
                effectiveProfileId = saved;
            } else {
                effectiveProfileId = 'default';
            }
        } else {
            effectiveProfileId = 'default';
        }
    }

    const isAll = effectiveProfileId === 'all';
    const isDefault = effectiveProfileId === null || effectiveProfileId === 'default' || !effectiveProfileId;
    const rpcProfileParam = isAll ? null : isDefault ? DEFAULT_WALLET_UUID : effectiveProfileId;

    const cacheKey = `${user ? user.id : 'ANON'}:${isAll ? 'ALL' : isDefault ? 'DEFAULT' : effectiveProfileId}`;
    const cached = financeSummaryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_30S)) {
        return cached.data;
    }

    if (financeSummaryPending.has(cacheKey)) {
        return financeSummaryPending.get(cacheKey)!;
    }

    const promise = (async () => {
        try {
            if (user) {
                try {
                    // First try high-performance Postgres RPC
                    // Note: RPC uses '00000000-0000-0000-0000-000000000000' for default wallet (profile_id IS NULL)
                    // and null for all wallets combined.
                    const { data, error } = await supabase.rpc('get_finance_summary', {
                        p_user_id: user.id,
                        p_profile_id: rpcProfileParam
                    });

                    if (!error && data) {
                        const res = {
                            balance: Number(data.balance || 0),
                            income: Number(data.income || 0),
                            expense: Number(data.expense || 0),
                            count: Number(data.count || 0),
                            lastTransaction: data.last_transaction || null
                        };
                        financeSummaryCache.set(cacheKey, { data: res, timestamp: Date.now() });
                        return res;
                    }
                } catch (rpcErr) {
                    // Fallback gracefully if RPC is unavailable
                }

                // Fallback: Lightweight metadata query
                let query = supabase.from('finance_transactions')
                    .select('id, amount, type, transaction_date, category, description, payment_method, profile_id')
                    .eq('user_id', user.id);

                if (!isAll) {
                    if (isDefault) {
                        query = query.is('profile_id', null);
                    } else {
                        query = query.eq('profile_id', effectiveProfileId);
                    }
                }

                const { data, error } = await query;
                if (error) {
                    logSupabaseError("Error fetching finance summary fallback", error);
                    return { balance: 0, income: 0, expense: 0, count: 0, lastTransaction: null };
                }
                
                const txs = (data || []) as any[];
                const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
                const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
                
                const sortedTxs = [...txs].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
                const last = sortedTxs[0] ? sortedTxs[0] : null;

                const res = { balance: income - expense, income, expense, count: txs.length, lastTransaction: last };
                financeSummaryCache.set(cacheKey, { data: res, timestamp: Date.now() });
                return res;
            }
            
            // Local DB logic (IndexedDB)
            const all = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
            const filtered = isAll 
                ? all 
                : (isDefault ? all.filter(t => !t.profile_id || t.profile_id === 'default') : all.filter(t => t.profile_id === effectiveProfileId));
            
            const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
            const sortedTxs = [...filtered].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
            const res = { balance: income - expense, income, expense, count: filtered.length, lastTransaction: sortedTxs[0] || null };
            financeSummaryCache.set(cacheKey, { data: res, timestamp: Date.now() });
            return res;
        } finally {
            financeSummaryPending.delete(cacheKey);
        }
    })();

    financeSummaryPending.set(cacheKey, promise);
    return promise;
};

export const getWalletTransactionCounts = async (user: User | null): Promise<Record<string, number>> => {
    const cacheKey = user ? user.id : 'ANON';
    const cached = walletCountsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_30S)) {
        return cached.data;
    }

    if (walletCountsPending.has(cacheKey)) {
        return walletCountsPending.get(cacheKey)!;
    }

    const promise = (async () => {
        try {
            if (user) {
                try {
                    const { data, error } = await supabase.rpc('get_wallet_transaction_counts', {
                        p_user_id: user.id
                    });
                    if (!error && Array.isArray(data)) {
                        const map: Record<string, number> = { default: 0 };
                        let total = 0;
                        data.forEach((item: { profile_id: string | null; count: number }) => {
                            const key = item.profile_id || 'default';
                            const c = Number(item.count || 0);
                            map[key] = c;
                            total += c;
                        });
                        map['all'] = total;
                        walletCountsCache.set(cacheKey, { data: map, timestamp: Date.now() });
                        return map;
                    }
                } catch {
                    // Fallback
                }
            }
            
            const all = await getTransactions(user);
            const map: Record<string, number> = { default: 0 };
            map['all'] = all.length;
            all.forEach(t => {
                const key = t.profile_id || 'default';
                map[key] = (map[key] || 0) + 1;
            });
            walletCountsCache.set(cacheKey, { data: map, timestamp: Date.now() });
            return map;
        } finally {
            walletCountsPending.delete(cacheKey);
        }
    })();

    walletCountsPending.set(cacheKey, promise);
    return promise;
};

export interface DailyFinanceData {
    date: string;
    day: number;
    income: number;
    expense: number;
    net: number;
    count: number;
}

export interface FinanceAnalyticsData {
    stats: FinancePeriodStats;
    categories: Array<{ category: string; type: string; total: number; count: number }>;
    monthly: Array<{ month_key: string; income: number; expense: number; net: number }>;
    daily: Array<DailyFinanceData>;
    top_expenses: Array<{ id: string; amount: number; category: string; description: string; transaction_date: string; payment_method: string; type?: string }>;
}

export const getFinanceAnalytics = async (
    user: User | null,
    profileIdOrOptions?: string | null | { profileId?: string | null; period?: string; year?: number; month?: number },
    yearArg?: number,
    monthArg?: number
): Promise<FinanceAnalyticsData> => {
    let profileId: string | null | undefined = undefined;
    let year = yearArg;
    let month = monthArg;

    if (profileIdOrOptions && typeof profileIdOrOptions === 'object') {
        profileId = profileIdOrOptions.profileId;
        if (profileIdOrOptions.period && profileIdOrOptions.period !== 'all') {
            if (profileIdOrOptions.period === 'this-month') {
                const now = new Date();
                year = now.getFullYear();
                month = now.getMonth() + 1;
            } else {
                const parts = profileIdOrOptions.period.split('-');
                if (parts.length === 2) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10);
                }
            }
        }
        if (profileIdOrOptions.year !== undefined) year = profileIdOrOptions.year;
        if (profileIdOrOptions.month !== undefined) month = profileIdOrOptions.month;
    } else {
        profileId = typeof profileIdOrOptions === 'string' ? profileIdOrOptions : (profileIdOrOptions === null ? null : undefined);
    }

    const isAll = profileId === 'all';
    const isDefault = profileId === null || profileId === 'default' || !profileId;
    const targetProfileId = isAll ? null : isDefault ? DEFAULT_WALLET_UUID : profileId;
    const cacheKey = `${user ? user.id : 'ANON'}:${isAll ? 'ALL' : isDefault ? 'DEFAULT' : targetProfileId}:${year || 'ALL'}:${month || 'ALL'}`;

    const cached = financeAnalyticsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_30S)) {
        return cached.data;
    }

    if (financeAnalyticsPending.has(cacheKey)) {
        return financeAnalyticsPending.get(cacheKey)!;
    }

    const promise = (async (): Promise<FinanceAnalyticsData> => {
        try {
            if (user) {
                try {
                    const { data, error } = await supabase.rpc('get_finance_analytics', {
                        p_user_id: user.id,
                        p_profile_id: targetProfileId,
                        p_year: year || null,
                        p_month: month || null
                    });
                    if (!error && data) {
                        const rawStats = data.stats || {};
                        const parsedStats: FinancePeriodStats = {
                            balance: Number(rawStats.balance || 0),
                            income: Number(rawStats.income || 0),
                            expense: Number(rawStats.expense || 0),
                            count: Number(rawStats.count || 0),
                            incomeCount: Number(rawStats.incomeCount || 0),
                            expenseCount: Number(rawStats.expenseCount || 0),
                            highestIncome: Number(rawStats.highestIncome || 0),
                            highestExpense: Number(rawStats.highestExpense || 0),
                            avgIncome: Number(rawStats.avgIncome || 0),
                            avgExpense: Number(rawStats.avgExpense || 0),
                            activeExpenseDays: Number(rawStats.activeExpenseDays || 0),
                            dailyAverage: Number(rawStats.dailyAverage || 0),
                            zeroSpendDays: Number(rawStats.zeroSpendDays || 0),
                            daysInPeriod: Number(rawStats.daysInPeriod || (year && month ? new Date(year, month, 0).getDate() : 30)),
                            savingsRatio: Number(rawStats.savingsRatio || 0),
                            topCategories: Array.isArray(rawStats.topCategories) ? rawStats.topCategories.map((c: any) => ({
                                name: String(c.name || ''),
                                value: Number(c.value || 0),
                                percentage: Number(c.percentage || 0)
                            })) : []
                        };

                        const parsedDaily: DailyFinanceData[] = Array.isArray(data.daily) ? data.daily.map((d: any) => ({
                            date: String(d.date || ''),
                            day: Number(d.day || 0),
                            income: Number(d.income || 0),
                            expense: Number(d.expense || 0),
                            net: Number(d.net || 0),
                            count: Number(d.count || 0)
                        })) : [];

                        const parsedMonthly = Array.isArray(data.monthly) ? data.monthly.map((m: any) => ({
                            month_key: String(m.month_key || ''),
                            income: Number(m.income || 0),
                            expense: Number(m.expense || 0),
                            net: Number(m.net || 0)
                        })) : [];

                        const parsedCategories = Array.isArray(data.categories) ? data.categories.map((c: any) => ({
                            category: String(c.category || ''),
                            type: String(c.type || 'expense'),
                            total: Number(c.total || 0),
                            count: Number(c.count || 0)
                        })) : [];

                        const parsedTopExpenses = Array.isArray(data.top_expenses) ? data.top_expenses.map((t: any) => ({
                            id: String(t.id || ''),
                            amount: Number(t.amount || 0),
                            category: String(t.category || ''),
                            description: String(t.description || ''),
                            transaction_date: String(t.transaction_date || ''),
                            payment_method: String(t.payment_method || ''),
                            type: String(t.type || 'expense')
                        })) : [];

                        const result: FinanceAnalyticsData = {
                            stats: parsedStats,
                            daily: parsedDaily,
                            monthly: parsedMonthly,
                            categories: parsedCategories,
                            top_expenses: parsedTopExpenses
                        };

                        financeAnalyticsCache.set(cacheKey, { data: result, timestamp: Date.now() });
                        return result;
                    }
                } catch (rpcErr) {
                    logSupabaseError("Error invoking get_finance_analytics RPC", rpcErr);
                }
            }

            // Fallback for offline/local storage or RPC failure
            const allLocal = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
            let filtered = (allLocal || []) as Transaction[];
            if (!isAll) {
                if (isDefault) {
                    filtered = filtered.filter(t => !t.profile_id || t.profile_id === 'default');
                } else {
                    filtered = filtered.filter(t => t.profile_id === targetProfileId);
                }
            }
            if (year && month) {
                filtered = filtered.filter(t => {
                    const d = new Date(t.transaction_date);
                    return d.getFullYear() === year && (d.getMonth() + 1) === month;
                });
            }

            let income = 0;
            let expense = 0;
            let incomeCount = 0;
            let expenseCount = 0;
            let highestIncome = 0;
            let highestExpense = 0;
            const categoryMap: Record<string, { income: number; expense: number; count: number }> = {};
            const dailyMap: Record<string, { income: number; expense: number; count: number }> = {};
            const monthlyMap: Record<string, { income: number; expense: number }> = {};
            const activeExpenseDaysSet = new Set<string>();

            filtered.forEach(t => {
                const amt = Number(t.amount || 0);
                const isInc = t.type === 'income';
                const d = new Date(t.transaction_date);
                const dStr = t.transaction_date ? t.transaction_date.split('T')[0] : '';
                const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                if (isInc) {
                    income += amt;
                    incomeCount++;
                    if (amt > highestIncome) highestIncome = amt;
                } else {
                    expense += amt;
                    expenseCount++;
                    if (amt > highestExpense) highestExpense = amt;
                    if (dStr) activeExpenseDaysSet.add(dStr);
                }

                if (dStr) {
                    if (!dailyMap[dStr]) dailyMap[dStr] = { income: 0, expense: 0, count: 0 };
                    if (isInc) dailyMap[dStr].income += amt;
                    else dailyMap[dStr].expense += amt;
                    dailyMap[dStr].count++;
                }

                if (!monthlyMap[mKey]) monthlyMap[mKey] = { income: 0, expense: 0 };
                if (isInc) monthlyMap[mKey].income += amt;
                else monthlyMap[mKey].expense += amt;

                const cat = t.category || 'Other';
                if (!categoryMap[cat]) categoryMap[cat] = { income: 0, expense: 0, count: 0 };
                if (isInc) categoryMap[cat].income += amt;
                else categoryMap[cat].expense += amt;
                categoryMap[cat].count++;
            });

            const balance = income - expense;
            const daysInPeriod = year && month ? new Date(year, month, 0).getDate() : Math.max(30, activeExpenseDaysSet.size);
            const activeExpenseDays = activeExpenseDaysSet.size;
            const dailyAverage = expense > 0 ? expense / Math.max(1, activeExpenseDays) : 0;
            const avgIncome = incomeCount > 0 ? income / Math.max(1, incomeCount) : 0;
            const avgExpense = expenseCount > 0 ? expense / Math.max(1, expenseCount) : 0;
            const zeroSpendDays = Math.max(0, daysInPeriod - activeExpenseDays);
            const savingsRatio = income > 0 ? (Math.max(0, balance) / income) * 100 : 0;

            const topCategories = Object.entries(categoryMap)
                .filter(([_, data]) => data.expense > 0)
                .sort((a, b) => b[1].expense - a[1].expense)
                .slice(0, 4)
                .map(([name, data]) => ({
                    name,
                    value: data.expense,
                    percentage: expense > 0 ? (data.expense / expense) * 100 : 0
                }));

            const stats: FinancePeriodStats = {
                balance, income, expense, count: filtered.length,
                incomeCount, expenseCount,
                highestIncome, highestExpense,
                avgIncome, avgExpense,
                activeExpenseDays, dailyAverage,
                zeroSpendDays, daysInPeriod,
                savingsRatio, topCategories
            };

            const daily: DailyFinanceData[] = Object.entries(dailyMap).map(([date, d]) => {
                const dayNum = parseInt(date.split('-')[2] || '1', 10);
                return {
                    date,
                    day: dayNum,
                    income: d.income,
                    expense: d.expense,
                    net: d.income - d.expense,
                    count: d.count
                };
            }).sort((a, b) => a.date.localeCompare(b.date));

            const monthly = Object.entries(monthlyMap).map(([month_key, m]) => ({
                month_key,
                income: m.income,
                expense: m.expense,
                net: m.income - m.expense
            })).sort((a, b) => a.month_key.localeCompare(b.month_key));

            const categories = [
                ...Object.entries(categoryMap).filter(([_, d]) => d.expense > 0).map(([category, d]) => ({
                    category, type: 'expense', total: d.expense, count: d.count
                })),
                ...Object.entries(categoryMap).filter(([_, d]) => d.income > 0).map(([category, d]) => ({
                    category, type: 'income', total: d.income, count: d.count
                }))
            ].sort((a, b) => b.total - a.total);

            const top_expenses = filtered
                .filter(t => t.type === 'expense')
                .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
                .slice(0, 5)
                .map(t => ({
                    id: t.id,
                    amount: Number(t.amount || 0),
                    category: t.category,
                    description: t.description,
                    transaction_date: t.transaction_date,
                    payment_method: t.payment_method,
                    type: 'expense'
                }));

            const fallbackResult: FinanceAnalyticsData = {
                stats, daily, monthly, categories, top_expenses
            };
            financeAnalyticsCache.set(cacheKey, { data: fallbackResult, timestamp: Date.now() });
            return fallbackResult;
        } finally {
            financeAnalyticsPending.delete(cacheKey);
        }
    })();

    financeAnalyticsPending.set(cacheKey, promise);
    return promise;
};

export interface FinancePeriodStats {
    balance: number;
    income: number;
    expense: number;
    count: number;
    incomeCount: number;
    expenseCount: number;
    highestIncome: number;
    highestExpense: number;
    avgIncome: number;
    avgExpense: number;
    activeExpenseDays: number;
    dailyAverage: number;
    zeroSpendDays: number;
    daysInPeriod: number;
    savingsRatio: number;
    topCategories: Array<{ name: string; value: number; percentage: number }>;
}

export const getFinancePeriodStats = async (
    user: User | null,
    options: {
        profileId?: string | null;
        dateFilter?: string;
        typeFilter?: 'all' | 'income' | 'expense';
        categoryFilter?: string;
    } = {}
): Promise<FinancePeriodStats> => {
    const { profileId, dateFilter = 'this-month', typeFilter = 'all', categoryFilter = 'all' } = options;

    let year: number | undefined;
    let month: number | undefined;
    let daysInPeriod = 30;

    if (dateFilter === 'this-month') {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
        daysInPeriod = new Date(year, month, 0).getDate();
    } else if (dateFilter && dateFilter.includes('-') && dateFilter !== 'all') {
        const parts = dateFilter.split('-');
        if (parts.length === 2) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            daysInPeriod = new Date(year, month, 0).getDate();
        }
    }

    const effectiveProfileId = profileId !== undefined ? profileId : (typeof window !== 'undefined' ? localStorage.getItem('ceaznet_active_wallet_id') : null);
    const isAll = effectiveProfileId === 'all';
    const isDefault = effectiveProfileId === null || effectiveProfileId === 'default' || !effectiveProfileId;

    if (typeFilter === 'all' && categoryFilter === 'all') {
        const analytics = await getFinanceAnalytics(user, profileId, year, month);
        return analytics.stats;
    }

    const cacheKey = `${user ? user.id : 'ANON'}:${isAll ? 'ALL' : isDefault ? 'DEFAULT' : effectiveProfileId}:${dateFilter}:${typeFilter}:${categoryFilter}`;
    const cached = financeStatsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_30S)) {
        return cached.data;
    }

    if (financeStatsPending.has(cacheKey)) {
        return financeStatsPending.get(cacheKey)!;
    }

    const promise = (async (): Promise<FinancePeriodStats> => {
        try {
            if (user) {
                // High-speed targeted query: select ONLY numerical & metadata columns without loading full transaction records
                let query = supabase.from('finance_transactions')
                    .select('amount, type, category, transaction_date')
                    .eq('user_id', user.id);

                if (!isAll) {
                    if (isDefault) {
                        query = query.is('profile_id', null);
                    } else {
                        query = query.eq('profile_id', effectiveProfileId);
                    }
                }

                if (year && month) {
                    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
                    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
                    query = query.gte('transaction_date', start).lte('transaction_date', end);
                }

                if (typeFilter !== 'all') {
                    query = query.eq('type', typeFilter);
                }

                if (categoryFilter !== 'all') {
                    query = query.ilike('category', categoryFilter);
                }

                const { data: rows, error } = await query;
                if (error) {
                    logSupabaseError("Error fetching finance period stats", error);
                }

                const txs = (rows || []) as Array<{ amount: number; type: string; category: string; transaction_date: string }>;
                let income = 0;
                let expense = 0;
                let incomeCount = 0;
                let expenseCount = 0;
                let highestIncome = 0;
                let highestExpense = 0;
                const categoryTotals: Record<string, number> = {};
                const activeExpenseDaysSet = new Set<string>();

                txs.forEach(t => {
                    const amt = Number(t.amount || 0);
                    const dateStr = t.transaction_date ? t.transaction_date.split('T')[0] : '';
                    if (t.type === 'income') {
                        income += amt;
                        incomeCount++;
                        if (amt > highestIncome) highestIncome = amt;
                    }
                    if (t.type === 'expense') {
                        expense += amt;
                        expenseCount++;
                        if (amt > highestExpense) highestExpense = amt;
                        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
                        if (dateStr) activeExpenseDaysSet.add(dateStr);
                    }
                });

                const balance = income - expense;
                const savingsRatio = income > 0 ? (Math.max(0, balance) / income) * 100 : 0;

                const topCategories = Object.entries(categoryTotals)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([name, value]) => ({
                        name,
                        value,
                        percentage: expense > 0 ? (value / expense) * 100 : 0
                    }));

                if (dateFilter === 'all') {
                    daysInPeriod = Math.max(30, activeExpenseDaysSet.size);
                }

                const activeExpenseDays = activeExpenseDaysSet.size;
                const dailyAverage = expense > 0 ? expense / Math.max(1, activeExpenseDays) : 0;
                const avgIncome = incomeCount > 0 ? income / Math.max(1, incomeCount) : 0;
                const avgExpense = expenseCount > 0 ? expense / Math.max(1, expenseCount) : 0;
                const zeroSpendDays = Math.max(0, daysInPeriod - activeExpenseDays);

                const res: FinancePeriodStats = {
                    balance, income, expense, count: txs.length,
                    incomeCount, expenseCount,
                    highestIncome, highestExpense,
                    avgIncome, avgExpense,
                    activeExpenseDays, dailyAverage,
                    zeroSpendDays, daysInPeriod,
                    savingsRatio, topCategories
                };
                financeStatsCache.set(cacheKey, { data: res, timestamp: Date.now() });
                return res;
            }

            // Fallback for local storage (guest/offline)
            const localData = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
            let filtered: Transaction[] = (localData || []) as Transaction[];
            
            if (!isAll) {
                if (isDefault) {
                    filtered = filtered.filter(t => !t.profile_id);
                } else {
                    filtered = filtered.filter(t => t.profile_id === effectiveProfileId);
                }
            }

            if (year && month) {
                filtered = filtered.filter(t => {
                    const d = new Date(t.transaction_date);
                    return d.getFullYear() === year && (d.getMonth() + 1) === month;
                });
            }

            if (typeFilter !== 'all') {
                filtered = filtered.filter(t => t.type === typeFilter);
            }

            if (categoryFilter !== 'all') {
                filtered = filtered.filter(t => t.category.toLowerCase() === categoryFilter.toLowerCase());
            }

            let income = 0;
            let expense = 0;
            let incomeCount = 0;
            let expenseCount = 0;
            let highestIncome = 0;
            let highestExpense = 0;
            const categoryTotals: Record<string, number> = {};
            const activeExpenseDaysSet = new Set<string>();

            filtered.forEach(t => {
                const amt = Number(t.amount || 0);
                const dateStr = t.transaction_date ? t.transaction_date.split('T')[0] : '';
                if (t.type === 'income') {
                    income += amt;
                    incomeCount++;
                    if (amt > highestIncome) highestIncome = amt;
                }
                if (t.type === 'expense') {
                    expense += amt;
                    expenseCount++;
                    if (amt > highestExpense) highestExpense = amt;
                    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
                    if (dateStr) activeExpenseDaysSet.add(dateStr);
                }
            });

            const balance = income - expense;
            const savingsRatio = income > 0 ? (Math.max(0, balance) / income) * 100 : 0;

            const topCategories = Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([name, value]) => ({
                    name,
                    value,
                    percentage: expense > 0 ? (value / expense) * 100 : 0
                }));

            if (dateFilter === 'all') {
                daysInPeriod = Math.max(30, activeExpenseDaysSet.size);
            }

            const activeExpenseDays = activeExpenseDaysSet.size;
            const dailyAverage = expense > 0 ? expense / Math.max(1, activeExpenseDays) : 0;
            const avgIncome = incomeCount > 0 ? income / Math.max(1, incomeCount) : 0;
            const avgExpense = expenseCount > 0 ? expense / Math.max(1, expenseCount) : 0;
            const zeroSpendDays = Math.max(0, daysInPeriod - activeExpenseDays);

            const res: FinancePeriodStats = {
                balance, income, expense, count: filtered.length,
                incomeCount, expenseCount,
                highestIncome, highestExpense,
                avgIncome, avgExpense,
                activeExpenseDays, dailyAverage,
                zeroSpendDays, daysInPeriod,
                savingsRatio, topCategories
            };
            financeStatsCache.set(cacheKey, { data: res, timestamp: Date.now() });
            return res;
        } finally {
            financeStatsPending.delete(cacheKey);
        }
    })();

    financeStatsPending.set(cacheKey, promise);
    return promise;
};

export const getDairySummary = async (user: User | null): Promise<{ due: number, paid: number }> => {
    const entries = await getDairyEntries(user);
    const payments = await getDairyPayments(user);
    
    const totalAmount = entries.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);
    
    // Sum all explicit payments
    let paidAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    
    // Add legacy entries that were marked as paid before the payments table existed
    for (const e of entries) {
        if (e.isPaid && !e.paymentId) {
            paidAmount += Number(e.totalPrice || 0);
        }
    }
    
    return { due: Math.max(0, totalAmount - paidAmount), paid: paidAmount };
};

export interface GetTransactionsOptions {
    profileId?: string | null;
    page?: number;
    pageSize?: number;
    searchQuery?: string;
    typeFilter?: string;
    categoryFilter?: string;
    startDate?: string | null;
    endDate?: string | null;
    fetchAll?: boolean;
}

export interface PaginatedTransactionsResult {
    data: Transaction[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
}

export const getTransactionsPaginated = async (
    user: User | null,
    options: GetTransactionsOptions = {}
): Promise<PaginatedTransactionsResult> => {
    const {
        profileId,
        page = 1,
        pageSize = 30,
        searchQuery,
        typeFilter,
        categoryFilter,
        startDate,
        endDate,
        fetchAll = false,
    } = options;

    const isDefault = (pid?: string | null) => pid === null || pid === 'default' || !pid;
    const isValidUUID = (pid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);

    if (!user) {
        let all = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
        if (profileId !== undefined) {
            if (isDefault(profileId)) {
                all = all.filter(t => isDefault(t.profile_id));
            } else {
                all = all.filter(t => t.profile_id === profileId);
            }
        }
        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            all = all.filter(t => (t.description || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
        }
        if (typeFilter && typeFilter !== 'all') {
            all = all.filter(t => t.type === typeFilter);
        }
        if (categoryFilter && categoryFilter !== 'all') {
            all = all.filter(t => t.category === categoryFilter);
        }
        if (startDate) {
            const startMs = new Date(startDate).setHours(0, 0, 0, 0);
            all = all.filter(t => new Date(t.transaction_date).getTime() >= startMs);
        }
        if (endDate) {
            const endMs = new Date(endDate).setHours(23, 59, 59, 999);
            all = all.filter(t => new Date(t.transaction_date).getTime() <= endMs);
        }
        all.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

        const totalCount = all.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const effectivePage = Math.max(1, Math.min(page, totalPages));
        const from = (effectivePage - 1) * pageSize;
        const data = fetchAll ? all : all.slice(from, from + pageSize);
        const hasMore = !fetchAll && from + pageSize < totalCount;

        return {
            data,
            totalCount,
            page: effectivePage,
            pageSize,
            totalPages,
            hasMore,
        };
    }

    const cacheKey = `${user.id}:${profileId === undefined ? 'ALL' : isDefault(profileId) ? 'DEFAULT' : profileId}:${fetchAll ? 'ALL' : `P${page}_S${pageSize}`}:${searchQuery || ''}:${typeFilter || ''}:${categoryFilter || ''}:${startDate || ''}:${endDate || ''}`;
    const cached = financeTransactionsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_30S)) {
        return cached.data;
    }

    if (financeTransactionsPending.has(cacheKey)) {
        return financeTransactionsPending.get(cacheKey)!;
    }

    const promise = (async () => {
        try {
            let query = supabase
                .from('finance_transactions')
                .select('*', { count: 'exact' })
                .eq('user_id', user.id);

            if (profileId !== undefined) {
                if (profileId && isValidUUID(profileId)) {
                    query = query.eq('profile_id', profileId);
                } else {
                    query = query.is('profile_id', null);
                }
            }

            if (typeFilter && typeFilter !== 'all') {
                query = query.eq('type', typeFilter);
            }

            if (categoryFilter && categoryFilter !== 'all') {
                query = query.eq('category', categoryFilter);
            }

            if (startDate) {
                query = query.gte('transaction_date', startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`);
            }

            if (endDate) {
                query = query.lte('transaction_date', endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`);
            }

            if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.trim();
                query = query.or(`description.ilike.%${q}%,category.ilike.%${q}%`);
            }

            query = query.order('transaction_date', { ascending: false });

            if (!fetchAll) {
                const from = (page - 1) * pageSize;
                const to = from + pageSize - 1;
                query = query.range(from, to);
            }

            const timeoutPromise = new Promise<{ data: any; error: any; count?: number | null }>((resolve) =>
                setTimeout(() => resolve({ data: null, error: { message: 'Timeout fetching transactions' } }), 12000)
            );

            const { data, error, count } = await Promise.race([query, timeoutPromise]);

            if (error) {
                logSupabaseError("Error fetching paginated transactions", error);
                const localAll = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
                const filtered = profileId === undefined ? localAll : isDefault(profileId) ? localAll.filter(t => isDefault(t.profile_id)) : localAll.filter(t => t.profile_id === profileId);
                const totalCount = filtered.length;
                const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
                const from = (page - 1) * pageSize;
                return {
                    data: fetchAll ? filtered : filtered.slice(from, from + pageSize),
                    totalCount,
                    page,
                    pageSize,
                    totalPages,
                    hasMore: !fetchAll && from + pageSize < totalCount,
                };
            }

            const res: Transaction[] = (data || []).map((t: any): Transaction => ({
                id: t.id,
                user_id: t.user_id,
                profile_id: t.profile_id,
                amount: t.amount,
                type: t.type,
                category: t.category,
                description: t.description,
                payment_method: t.payment_method,
                transaction_date: t.transaction_date,
                created_at: t.created_at,
                metadata: t.metadata,
            }));

            const totalCount = count !== null && count !== undefined ? count : res.length;
            const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
            const hasMore = !fetchAll && page * pageSize < totalCount;

            const result: PaginatedTransactionsResult = {
                data: res,
                totalCount,
                page,
                pageSize,
                totalPages,
                hasMore,
            };

            financeTransactionsCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        } catch (err) {
            console.error("Unexpected error in getTransactionsPaginated:", err);
            return {
                data: [],
                totalCount: 0,
                page,
                pageSize,
                totalPages: 1,
                hasMore: false,
            };
        } finally {
            financeTransactionsPending.delete(cacheKey);
        }
    })();

    financeTransactionsPending.set(cacheKey, promise);
    return promise;
};

export const getTransactions = async (user: User | null, profileId?: string | null): Promise<Transaction[]> => {
    const res = await getTransactionsPaginated(user, { profileId, fetchAll: true });
    return res.data;
};

export const getTransactionsForExport = async (
    user: User | null,
    options: {
        profileId?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        typeFilter?: string;
        categoryFilter?: string;
    } = {}
): Promise<Transaction[]> => {
    const res = await getTransactionsPaginated(user, {
        profileId: options.profileId,
        startDate: options.startDate,
        endDate: options.endDate,
        typeFilter: options.typeFilter,
        categoryFilter: options.categoryFilter,
        fetchAll: true
    });
    return res.data;
};

export const getTransactionsForDate = async (
    user: User | null,
    dateStr: string,
    profileId?: string | null
): Promise<Transaction[]> => {
    const res = await getTransactionsPaginated(user, {
        profileId,
        startDate: dateStr,
        endDate: dateStr,
        fetchAll: true
    });
    return res.data;
};

export const saveTransactionsBulk = async (transactions: Transaction[], user: User | null) => {
    if (user) {
        const payload = transactions.map(t => ({
            id: t.id,
            user_id: user.id,
            profile_id: t.profile_id,
            amount: t.amount,
            type: t.type,
            category: t.category,
            description: t.description,
            payment_method: t.payment_method,
            transaction_date: t.transaction_date,
            created_at: t.created_at,
            metadata: t.metadata
        }));
        const { error } = await supabase.from('finance_transactions').upsert(payload, { onConflict: 'id' });
        if (error) logSupabaseError("Error bulk saving transactions", error);
    } else {
        for (const t of transactions) {
            await saveToLocalDB(STORES.FINANCE, t, t.id);
        }
    }
};

export const saveTransaction = async (transaction: Transaction, user: User | null) => {
    // If transaction involves a vehicle, update vehicle odometer
    if (transaction.metadata?.vehicle_id && transaction.metadata?.odometer_reading) {
        const vehicles = await getVehicles(user);
        const vehicle = vehicles.find(v => v.id === transaction.metadata?.vehicle_id);
        if (vehicle && transaction.metadata.odometer_reading > vehicle.current_odometer) {
             const updatedVehicle = { ...vehicle, current_odometer: transaction.metadata.odometer_reading };
             await saveVehicle(updatedVehicle, user);
        }
    }

    if (user) {
        const { error } = await supabase.from('finance_transactions').upsert({
            id: transaction.id,
            user_id: user.id,
            profile_id: transaction.profile_id,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            description: transaction.description,
            payment_method: transaction.payment_method,
            transaction_date: transaction.transaction_date,
            created_at: transaction.created_at,
            metadata: transaction.metadata // Save metadata
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving transaction", error);
    } else {
        await saveToLocalDB(STORES.FINANCE, transaction, transaction.id);
    }
};

export const deleteTransaction = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting transaction", error);
    } else {
        await deleteFromLocalDB(STORES.FINANCE, id);
    }
};


// --- MOLECULE HISTORY & FAVORITES ---

export interface MoleculeContext {
    name: string;
    settings?: MoleculeViewerState;
}

export const getLastMolecule = async (user: User | null): Promise<MoleculeContext | null> => {
    if (user) {
        const settings = await getSupabaseSettings(user);
        if (!settings.last_molecule) return null;
        return {
            name: settings.last_molecule,
            settings: settings.last_molecule_settings
        };
    }
    const local = localStorage.getItem('ceaznet_last_molecule_ctx');
    return local ? JSON.parse(local) : null;
};

export const saveLastMolecule = async (name: string, settings: MoleculeViewerState | undefined, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('user_settings').upsert({ 
            user_id: user.id, 
            last_molecule: name, 
            last_molecule_settings: settings,
            updated_at: new Date() 
        });
        if (error) logSupabaseError("Error saving last molecule context", error);
    } else {
        localStorage.setItem('ceaznet_last_molecule_ctx', JSON.stringify({ name, settings }));
    }
};

export const getUserMolecules = async (user: User | null): Promise<UserMolecule[]> => {
    if (user) {
        // Strip out 'data' columns from molecules for list view heavily reducing payload
        const { data, error } = await supabase
            .from('user_molecules')
            .select('id, user_id, name, settings, is_favorite, last_viewed_at, created_at')
            .eq('user_id', user.id)
            .order('last_viewed_at', { ascending: false });
        
        if (error) {
            logSupabaseError("Error fetching user molecules", error);
            return [];
        }
        return (data || []).map(m => ({
            id: m.id,
            user_id: m.user_id,
            name: m.name,
            settings: m.settings,
            isFavorite: m.is_favorite,
            lastViewedAt: m.last_viewed_at,
            createdAt: m.created_at
        }));
    }
    const localData = await getAllFromLocalDB<UserMolecule>(STORES.MOLECULES);
    return localData.map(m => {
        const { data, ...rest } = m;
        return rest;
    });
};

export const getUserMoleculeById = async (id: string, user: User | null): Promise<UserMolecule | null> => {
    if (user) {
        const { data, error } = await supabase
            .from('user_molecules')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            logSupabaseError("Error fetching user molecule details", error);
            return null;
        }
        return {
            id: data.id,
            user_id: data.user_id,
            name: data.name,
            data: data.data,
            settings: data.settings,
            isFavorite: data.is_favorite,
            lastViewedAt: data.last_viewed_at,
            createdAt: data.created_at
        };
    }
    return await getFromLocalDB<UserMolecule>(STORES.MOLECULES, id) || null;
};

export const saveUserMolecule = async (molecule: Partial<UserMolecule>, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('user_molecules').upsert({
            id: molecule.id,
            user_id: user.id,
            name: molecule.name,
            data: molecule.data,
            settings: molecule.settings,
            is_favorite: molecule.isFavorite,
            last_viewed_at: new Date().toISOString()
        }, { onConflict: 'user_id, name' });
        
        if (error) logSupabaseError("Error saving user molecule", error);
    } else {
        const id = molecule.id || crypto.randomUUID();
        const fullMolecule = {
            ...molecule,
            id,
            lastViewedAt: new Date().toISOString(),
            createdAt: molecule.createdAt || new Date().toISOString()
        } as UserMolecule;
        await saveToLocalDB(STORES.MOLECULES, fullMolecule, id);
    }
};

export const deleteUserMolecule = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('user_molecules').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting molecule", error);
    } else {
        await deleteFromLocalDB(STORES.MOLECULES, id);
    }
};

// --- DAIRY / DAILY KHATA ---
export const getDairyItems = async (user: User | null): Promise<DairyItem[]> => {
    if (!user) {
        const items = localStorage.getItem('ceaznet_dairy_items');
        if (!items) return [];
        try {
            const parsedItems = JSON.parse(items);
            return parsedItems.map((item: any): DairyItem => {
                let name = item.name;
                let icon = item.icon;
                let isPaidByDefault = false;
                if (item.name && item.name.includes('::')) {
                    const parts = item.name.split('::');
                    name = parts[0];
                    icon = parts[1] || undefined;
                    isPaidByDefault = parts[2] === 'paid';
                }
                return {
                    ...item,
                    name,
                    icon,
                    isPaidByDefault
                };
            });
        } catch (e) {
            return [];
        }
    }

    const userId = user.id;
    if (dairyItemsCache && dairyItemsCache.user_id === userId && (Date.now() - dairyItemsCache.timestamp < CACHE_TTL_30S)) {
        return dairyItemsCache.data;
    }

    if (dairyItemsPending.has(userId)) {
        return dairyItemsPending.get(userId)!;
    }

    const promise = (async () => {
        try {
            const { data, error } = await supabase.from('dairy_items').select('*').eq('user_id', userId);
            if (error) {
                logSupabaseError("Error fetching dairy items", error);
                return [];
            }
            const res = (data || []).map((item): DairyItem => {
                let name = item.name;
                let icon = undefined;
                let isPaidByDefault = false;
                if (item.name && item.name.includes('::')) {
                    const parts = item.name.split('::');
                    name = parts[0];
                    icon = parts[1] || undefined;
                    isPaidByDefault = parts[2] === 'paid';
                }
                return {
                    id: item.id,
                    user_id: item.user_id,
                    name: name,
                    defaultPrice: item.default_price,
                    unit: item.unit,
                    defaultQuantity: item.default_quantity,
                    icon: icon,
                    isPaidByDefault: isPaidByDefault,
                    createdAt: item.created_at,
                };
            });
            dairyItemsCache = { user_id: userId, data: res, timestamp: Date.now() };
            return res;
        } finally {
            dairyItemsPending.delete(userId);
        }
    })();

    dairyItemsPending.set(userId, promise);
    return promise;
};

export const saveDairyItem = async (item: DairyItem, user: User | null) => {
    invalidateDairyCache();
    const dbName = `${item.name}::${item.icon || ''}::${item.isPaidByDefault ? 'paid' : 'unpaid'}`;
    if (user) {
        const { error } = await supabase.from('dairy_items').upsert({
            id: item.id,
            user_id: user.id,
            name: dbName,
            default_price: item.defaultPrice,
            unit: item.unit,
            default_quantity: item.defaultQuantity,
            created_at: item.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving dairy item", error);
    } else {
        const items = await getDairyItems(null);
        // Save the item with the encoded name to localStorage
        const itemToSave = { 
            ...item, 
            name: dbName
        };
        const index = items.findIndex(i => i.id === item.id);
        if (index >= 0) {
            // Overwrite in items array
            items[index] = itemToSave;
        } else {
            items.push(itemToSave);
        }
        localStorage.setItem('ceaznet_dairy_items', JSON.stringify(items));
    }
};

export const deleteDairyItem = async (id: string, user: User | null) => {
    invalidateDairyCache();
    if (user) {
        // Delete associated entries first to prevent orphans
        const { error: entriesError } = await supabase.from('dairy_entries').delete().eq('item_id', id);
        if (entriesError) logSupabaseError("Error deleting associated entries", entriesError);

        // Delete associated payments first to prevent orphans
        const { error: paymentsError } = await supabase.from('dairy_payments').delete().eq('item_id', id);
        if (paymentsError) logSupabaseError("Error deleting associated payments", paymentsError);

        // Delete the dairy item itself
        const { error } = await supabase.from('dairy_items').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting dairy item", error);
    } else {
        const items = await getDairyItems(null);
        const filteredItems = items.filter(i => i.id !== id);
        localStorage.setItem('ceaznet_dairy_items', JSON.stringify(filteredItems));

        const entries = await getDairyEntries(null);
        const filteredEntries = entries.filter(e => e.itemId !== id);
        localStorage.setItem('ceaznet_dairy_entries', JSON.stringify(filteredEntries));

        const payments = await getDairyPayments(null);
        const filteredPayments = payments.filter(p => p.itemId !== id);
        localStorage.setItem('ceaznet_dairy_payments', JSON.stringify(filteredPayments));
    }
};

export const getDairyEntries = async (user: User | null): Promise<DairyEntry[]> => {
    if (!user) {
        const entries = localStorage.getItem('ceaznet_dairy_entries');
        const rawEntries: DairyEntry[] = entries ? JSON.parse(entries) : [];
        const items = await getDairyItems(user);
        const itemIds = new Set(items.map(i => i.id));
        return rawEntries.filter(e => e.itemId && itemIds.has(e.itemId));
    }

    const userId = user.id;
    if (dairyEntriesCache && dairyEntriesCache.user_id === userId && (Date.now() - dairyEntriesCache.timestamp < CACHE_TTL_30S)) {
        return dairyEntriesCache.data;
    }

    if (dairyEntriesPending.has(userId)) {
        return dairyEntriesPending.get(userId)!;
    }

    const promise = (async () => {
        try {
            const { data, error } = await supabase.from('dairy_entries').select('*').eq('user_id', userId);
            if (error) {
                logSupabaseError("Error fetching dairy entries", error);
                return [];
            }
            const rawEntries = (data || []).map((entry): DairyEntry => {
                let notes = entry.note;
                let isPaid = false;
                let paymentId = undefined;
                
                if (entry.note && typeof entry.note === 'string' && entry.note.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(entry.note);
                        if (parsed._isJsonNote) {
                            notes = parsed.text;
                            isPaid = parsed.isPaid || false;
                            paymentId = parsed.paymentId;
                        }
                    } catch (e) {
                        // Not JSON, treat as normal note
                    }
                }
                
                return {
                    id: entry.id,
                    user_id: entry.user_id,
                    itemId: entry.item_id,
                    date: entry.entry_date,
                    quantity: entry.quantity,
                    pricePerUnit: entry.price_per_unit,
                    totalPrice: entry.total_price,
                    isPaid,
                    paymentId,
                    notes,
                    createdAt: entry.created_at,
                };
            });

            const items = await getDairyItems(user);
            const itemIds = new Set(items.map(i => i.id));
            const filtered = rawEntries.filter(e => e.itemId && itemIds.has(e.itemId));
            dairyEntriesCache = { user_id: userId, data: filtered, timestamp: Date.now() };
            return filtered;
        } finally {
            dairyEntriesPending.delete(userId);
        }
    })();

    dairyEntriesPending.set(userId, promise);
    return promise;
};

export const saveDairyEntry = async (entry: DairyEntry, user: User | null) => {
    invalidateDairyCache();
    if (user) {
        const notePayload = JSON.stringify({
            _isJsonNote: true,
            text: entry.notes || '',
            isPaid: entry.isPaid || false,
            paymentId: entry.paymentId
        });

        const { error } = await supabase.from('dairy_entries').upsert({
            id: entry.id,
            user_id: user.id,
            item_id: entry.itemId,
            quantity: entry.quantity,
            price_per_unit: entry.pricePerUnit,
            total_price: entry.totalPrice,
            entry_date: entry.date,
            note: notePayload,
            created_at: entry.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving dairy entry", error);
    } else {
        const entries = await getDairyEntries(null);
        const index = entries.findIndex(e => e.id === entry.id);
        if (index >= 0) entries[index] = entry;
        else entries.push(entry);
        localStorage.setItem('ceaznet_dairy_entries', JSON.stringify(entries));
    }
};

export const deleteDairyEntry = async (id: string, user: User | null) => {
    invalidateDairyCache();

    // Find the entry first so we know its details for deleting associated payments
    let entryToDelete: DairyEntry | undefined = undefined;
    if (user) {
        try {
            const { data } = await supabase.from('dairy_entries').select('*').eq('id', id).single();
            if (data) {
                let notes = data.note;
                let isPaid = false;
                let paymentId = undefined;
                if (data.note && typeof data.note === 'string' && data.note.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(data.note);
                        if (parsed._isJsonNote) {
                            notes = parsed.text;
                            isPaid = parsed.isPaid || false;
                            paymentId = parsed.paymentId;
                        }
                    } catch (e) {}
                }
                entryToDelete = {
                    id: data.id,
                    itemId: data.item_id,
                    date: data.entry_date,
                    quantity: data.quantity,
                    pricePerUnit: data.price_per_unit,
                    totalPrice: data.total_price,
                    isPaid,
                    paymentId,
                    notes,
                    createdAt: data.created_at
                };
            }
        } catch (e) {
            console.error("Error fetching entry to delete", e);
        }
    } else {
        const entries = await getDairyEntries(null);
        entryToDelete = entries.find(e => e.id === id);
    }

    // Delete associated payments
    if (entryToDelete) {
        const allPayments = await getDairyPayments(user);
        const paymentsToDelete = allPayments.filter(p => 
            p.id === entryToDelete?.paymentId ||
            (p as any).entryId === entryToDelete?.id ||
            (p.itemId === entryToDelete?.itemId && p.date === entryToDelete?.date && p.notes?.includes("Auto-recorded"))
        );

        for (const payment of paymentsToDelete) {
            await deleteDairyPayment(payment.id, user);
        }
    }

    if (user) {
        const { error } = await supabase.from('dairy_entries').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting dairy entry", error);
    } else {
        const entries = await getDairyEntries(null);
        const filtered = entries.filter(e => e.id !== id);
        localStorage.setItem('ceaznet_dairy_entries', JSON.stringify(filtered));
    }
};

export const getDairyPayments = async (user: User | null): Promise<DairyPayment[]> => {
    if (!user) {
        const payments = localStorage.getItem('ceaznet_dairy_payments');
        const rawPayments: DairyPayment[] = payments ? JSON.parse(payments) : [];
        const items = await getDairyItems(user);
        const itemIds = new Set(items.map(i => i.id));
        return rawPayments.filter(p => p.itemId === 'general' || (p.itemId && itemIds.has(p.itemId)));
    }

    const userId = user.id;
    if (dairyPaymentsCache && dairyPaymentsCache.user_id === userId && (Date.now() - dairyPaymentsCache.timestamp < CACHE_TTL_30S)) {
        return dairyPaymentsCache.data;
    }

    if (dairyPaymentsPending.has(userId)) {
        return dairyPaymentsPending.get(userId)!;
    }

    const promise = (async () => {
        try {
            const { data, error } = await supabase.from('dairy_payments').select('*').eq('user_id', userId);
            if (error) {
                logSupabaseError("Error fetching dairy payments", error);
                return [];
            }
            const rawPayments = (data || []).map((payment): DairyPayment => {
                let notes = payment.note;
                let entryId = undefined;
                if (payment.note && typeof payment.note === 'string' && payment.note.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(payment.note);
                        if (parsed._isJsonPaymentNote) {
                            notes = parsed.notes;
                            entryId = parsed.entryId;
                        }
                    } catch (e) {
                        // Not JSON, keep original
                    }
                }
                const res: DairyPayment = {
                    id: payment.id,
                    user_id: payment.user_id,
                    itemId: payment.item_id || 'general',
                    date: payment.payment_date,
                    amount: payment.amount,
                    notes: notes,
                    createdAt: payment.created_at,
                };
                if (entryId) {
                    (res as any).entryId = entryId;
                }
                return res;
            });

            const items = await getDairyItems(user);
            const itemIds = new Set(items.map(i => i.id));
            const filtered = rawPayments.filter(p => p.itemId === 'general' || (p.itemId && itemIds.has(p.itemId)));
            dairyPaymentsCache = { user_id: userId, data: filtered, timestamp: Date.now() };
            return filtered;
        } finally {
            dairyPaymentsPending.delete(userId);
        }
    })();

    dairyPaymentsPending.set(userId, promise);
    return promise;
};

export const saveDairyPayment = async (payment: DairyPayment, user: User | null) => {
    invalidateDairyCache();
    const entryId = (payment as any).entryId;
    const noteValue = entryId ? JSON.stringify({
        _isJsonPaymentNote: true,
        notes: payment.notes || '',
        entryId: entryId
    }) : payment.notes;

    if (user) {
        let payload: any = {
            id: payment.id,
            user_id: user.id,
            item_id: payment.itemId === 'general' ? null : payment.itemId,
            amount: payment.amount,
            payment_date: payment.date,
            note: noteValue,
            created_at: payment.createdAt || new Date().toISOString(),
        };
        
        const { error } = await supabase.from('dairy_payments').upsert(payload, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving dairy payment", error);
    } else {
        const payments = await getDairyPayments(null);
        const index = payments.findIndex(p => p.id === payment.id);
        const paymentToSave = { ...payment };
        if (index >= 0) payments[index] = paymentToSave;
        else payments.push(paymentToSave);
        localStorage.setItem('ceaznet_dairy_payments', JSON.stringify(payments));
    }
};

export const deleteDairyPayment = async (id: string, user: User | null) => {
    invalidateDairyCache();
    if (user) {
        const { error } = await supabase.from('dairy_payments').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting dairy payment", error);
    } else {
        const payments = await getDairyPayments(null);
        const filtered = payments.filter(p => p.id !== id);
        localStorage.setItem('ceaznet_dairy_payments', JSON.stringify(filtered));
    }
};

export const exportDairyData = async (user: User | null, options?: { itemId?: string, startDate?: string, endDate?: string }): Promise<string> => {
    let items = await getDairyItems(user);
    let entries = await getDairyEntries(user);
    let payments = await getDairyPayments(user);

    if (options?.itemId) {
        items = items.filter(i => i.id === options.itemId);
        entries = entries.filter(e => e.itemId === options.itemId);
        payments = payments.filter(p => p.itemId === options.itemId);
    }

    if (options?.startDate) {
        entries = entries.filter(e => e.date >= options.startDate!);
        payments = payments.filter(p => p.date >= options.startDate!);
    }

    if (options?.endDate) {
        entries = entries.filter(e => e.date <= options.endDate!);
        payments = payments.filter(p => p.date <= options.endDate!);
    }

    const data = {
        items,
        entries,
        payments
    };
    return JSON.stringify(data, null, 2);
};

export const importDairyData = async (jsonData: string, user: User | null): Promise<boolean> => {
    try {
        const data = JSON.parse(jsonData);
        if (!data.items || !Array.isArray(data.items)) return false;

        const itemIds = new Set(data.items.map((i: any) => i.id));

        // Save items first
        for (const item of data.items) {
            await saveDairyItem(item, user);
        }

        // Filter and save entries
        if (data.entries && Array.isArray(data.entries)) {
            const validEntries = data.entries.filter((entry: any) => entry.itemId && itemIds.has(entry.itemId));
            for (const entry of validEntries) {
                await saveDairyEntry(entry, user);
            }
        }

        // Filter and save payments
        if (data.payments && Array.isArray(data.payments)) {
            const validPayments = data.payments.filter((payment: any) => payment.itemId === 'general' || (payment.itemId && itemIds.has(payment.itemId)));
            for (const payment of validPayments) {
                await saveDairyPayment(payment, user);
            }
        }
        return true;
    } catch (error) {
        console.error("Error importing dairy data:", error);
        return false;
    }
};

// Local-only data stores
export const getLocalUserProfile = () => getFromLocalDB<UserProfile>(STORES.USER_PROFILE, 'singleton').then(res => res || { name: null, full_name: null, avatar_url: null });
export const saveUserProfile = (profile: UserProfile) => saveToLocalDB(STORES.USER_PROFILE, profile, 'singleton');

// Translator Usage & History
export interface TranslationHistoryRecord {
    id?: string;
    user_id?: string;
    input_text: string;
    output_text: string;
    input_tokens: number;
    output_tokens: number;
    source_lang?: string;
    target_lang?: string;
    model?: string;
    created_at?: string;
}

export const getTranslatorUsage = async (user: User | null): Promise<{ input: number, output: number }> => {
    if (user) {
        const settings = await getSupabaseSettings(user);
        return settings.translator_usage || { input: 0, output: 0 };
    }
    return getFromLocalDB<{ input: number, output: number }>(STORES.TRANSLATOR_USAGE, 'singleton').then(res => res || { input: 0, output: 0 });
};

export const saveTranslatorUsage = async (usage: { input: number, output: number }, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, translator_usage: usage, updated_at: new Date() });
        if (error) logSupabaseError("Error saving remote translator usage", error);
    } else {
        await saveToLocalDB(STORES.TRANSLATOR_USAGE, usage, 'singleton');
    }
};

export const saveTranslationHistoryItem = async (
    item: Omit<TranslationHistoryRecord, 'id' | 'user_id' | 'created_at'>,
    user: User | null
): Promise<void> => {
    const record: TranslationHistoryRecord = {
        id: 'th_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        ...item,
        created_at: new Date().toISOString(),
    };

    if (user) {
        try {
            const { error } = await supabase.from('translation_history').insert({
                user_id: user.id,
                input_text: item.input_text || '',
                output_text: item.output_text || '',
                input_tokens: item.input_tokens || 0,
                output_tokens: item.output_tokens || 0,
                source_lang: item.source_lang || '',
                target_lang: item.target_lang || '',
                model: item.model || ''
            });
            if (error) logSupabaseError("Error inserting remote translation history", error);
        } catch (e) {
            console.error("Failed to insert translation history in Supabase:", e);
        }
    }

    // Also persist in local storage/cache (capped to 100 entries)
    try {
        const localRaw = localStorage.getItem('ceaznet_translator_history');
        const localList: TranslationHistoryRecord[] = localRaw ? JSON.parse(localRaw) : [];
        const updatedList = [record, ...localList].slice(0, 100);
        localStorage.setItem('ceaznet_translator_history', JSON.stringify(updatedList));
    } catch (e) {
        console.error("Local history cache error:", e);
    }
};

export const getTranslationHistory = async (
    user: User | null,
    limit: number = 20,
    offset: number = 0
): Promise<TranslationHistoryRecord[]> => {
    if (user) {
        try {
            const { data, error } = await supabase
                .from('translation_history')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                logSupabaseError("Error fetching remote translation history", error);
                // Fallback to local storage on error
                const localRaw = localStorage.getItem('ceaznet_translator_history');
                const localList: TranslationHistoryRecord[] = localRaw ? JSON.parse(localRaw) : [];
                return localList.slice(offset, offset + limit);
            }

            return data || [];
        } catch (e) {
            console.error("Failed to fetch translation history from Supabase:", e);
        }
    }

    // Unauthenticated / offline mode
    const localRaw = localStorage.getItem('ceaznet_translator_history');
    const localList: TranslationHistoryRecord[] = localRaw ? JSON.parse(localRaw) : [];
    return localList.slice(offset, offset + limit);
};

export const clearTranslationHistory = async (user: User | null): Promise<void> => {
    if (user) {
        try {
            const { error } = await supabase
                .from('translation_history')
                .delete()
                .eq('user_id', user.id);

            if (error) logSupabaseError("Error clearing translation history from Supabase", error);
        } catch (e) {
            console.error("Failed to clear remote translation history:", e);
        }
    }

    try {
        localStorage.removeItem('ceaznet_translator_history');
    } catch (e) {
        console.error("Failed to clear local translation history cache:", e);
    }
};

export const exportData = async (user: User | null): Promise<string> => {
    const data: any = {};
    
    data.conversations = await getConversations(user);
    data.notes = await getNotes(user);
    data.financeProfiles = await getFinanceProfiles(user);
    data.vehicles = await getVehicles(user);
    data.transactions = await getTransactions(user);
    data.translatorUsage = await getTranslatorUsage(user);
    
    // Local storage items
    data.dairyItems = localStorage.getItem('ceaznet_dairy_items');
    data.dairyEntries = localStorage.getItem('ceaznet_dairy_entries');
    data.dairyPayments = localStorage.getItem('ceaznet_dairy_payments');
    data.uiPreferences = localStorage.getItem('ceaznet_ui_preferences');
    data.anonInteractions = localStorage.getItem('ceaznet_anon_interactions');
    
    return JSON.stringify(data, null, 2);
};

export const importData = async (jsonData: string, user: User | null): Promise<void> => {
    const data = JSON.parse(jsonData);
    
    if (data.conversations) {
        for (const convo of data.conversations) {
            await saveConversation(convo, user);
        }
    }
    if (data.notes) {
        for (const note of data.notes) {
            await saveNote(note, user);
        }
    }
    if (data.financeProfiles) {
        for (const profile of data.financeProfiles) {
            await saveFinanceProfile(profile, user);
        }
    }
    if (data.vehicles) {
        for (const vehicle of data.vehicles) {
            await saveVehicle(vehicle, user);
        }
    }
    if (data.transactions) {
        for (const transaction of data.transactions) {
            await saveTransaction(transaction, user);
        }
    }
    if (data.translatorUsage) {
        await saveTranslatorUsage(data.translatorUsage, user);
    }
    
    if (data.dairyItems) localStorage.setItem('ceaznet_dairy_items', data.dairyItems);
    if (data.dairyEntries) localStorage.setItem('ceaznet_dairy_entries', data.dairyEntries);
    if (data.dairyPayments) localStorage.setItem('ceaznet_dairy_payments', data.dairyPayments);
    if (data.uiPreferences) localStorage.setItem('ceaznet_ui_preferences', data.uiPreferences);
    if (data.anonInteractions) localStorage.setItem('ceaznet_anon_interactions', data.anonInteractions);
};

// --- GALLERY ITEMS ---
export const getGalleryItems = async (user: User | null): Promise<GalleryItem[]> => {
    if (user) {
        const { data, error } = await supabase.from('gallery_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) {
            logSupabaseError("Error fetching gallery items", error);
            return [];
        }
        return (data || []).map((item): GalleryItem => ({
            id: item.id,
            user_id: item.user_id,
            url: item.url,
            type: item.type,
            mimeType: item.mime_type,
            filename: item.filename,
            size: item.size,
            createdAt: item.created_at,
            width: item.width,
            height: item.height,
            duration: item.duration,
        }));
    }
    const localItems = await getAllFromLocalDB<GalleryItem>(STORES.GALLERY_ITEMS);
    return localItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const saveGalleryItem = async (item: GalleryItem, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('gallery_items').upsert({
            id: item.id,
            user_id: user.id,
            url: item.url,
            type: item.type,
            mime_type: item.mimeType,
            filename: item.filename,
            size: item.size,
            created_at: item.createdAt,
            width: item.width,
            height: item.height,
            duration: item.duration,
        }, { onConflict: 'id' });
        if (error) {
            logSupabaseError("Error saving gallery item", error);
        }
    } else {
        await saveToLocalDB(STORES.GALLERY_ITEMS, item, item.id);
    }
};

export const deleteGalleryItem = async (id: string, user: User | null) => {
    // Delete from telegram
    let urlToDelete: string | null = null;
    if (user) {
        const { data, error } = await supabase.from('gallery_items').select('url').eq('id', id).maybeSingle();
        if (!error && data) {
            urlToDelete = data.url;
        }
    } else {
        const localItem = await getFromLocalDB<GalleryItem>(STORES.GALLERY_ITEMS, id);
        if (localItem) {
            urlToDelete = localItem.url;
        }
    }

    if (urlToDelete && urlToDelete.startsWith('tg://')) {
        try {
            const { deleteFileFromTelegram } = await import('./telegramStorage');
            await deleteFileFromTelegram(urlToDelete);
        } catch (err) {
            console.error('Failed to delete file from Telegram:', err);
        }
    }

    if (user) {
        const { error } = await supabase.from('gallery_items').delete().eq('id', id);
        if (error) {
            logSupabaseError("Error deleting gallery item", error);
        }
    } else {
        await deleteFromLocalDB(STORES.GALLERY_ITEMS, id);
    }
};