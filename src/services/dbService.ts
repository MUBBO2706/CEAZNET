




import { Conversation, UserProfile, ArticleConversation, UserArticleInteraction, Note, Transaction, FinanceProfile, Vehicle, DairyItem, DairyEntry, DairyPayment, GalleryItem, MoleculeViewerState, UserMolecule, MoleculeData } from '../types';
import { supabase } from './supabaseClient';
import type { User } from '@supabase/supabase-js';

const DB_NAME = 'KalinaAppDB';
const DB_VERSION = 8; // Incremented for Gallery & Molecules
const STORES = {
    CONVERSATIONS: 'conversations',
    SETTINGS: 'settings',
    USER_PROFILE: 'userProfile',
    TRANSLATOR_USAGE: 'translatorUsage',
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
        const keyMapping: Record<string, string> = { 'kalina_api_key': 'api_key', 'kalina_voice_mode_voice': 'voice_mode_voice', 'kalina_voice_mode_persona_instruction': 'voice_mode_persona_instruction', 'kalina_voice_mode_tone_instruction': 'voice_mode_tone_instruction', 'kalina_voice_mode_custom_instruction': 'voice_mode_custom_instruction', 'kalina_voice_proactive_mode': 'voice_proactive_mode', 'kalina_voice_recording_enabled': 'voice_recording_enabled', 'kalina_voice_personas': 'voice_personas', 'kalina_voice_persona': 'voice_persona' };
        return settings[keyMapping[key]] as T;
    }
    return getFromLocalDB<T>(STORES.SETTINGS, key);
};
export const saveSetting = async (key: string, value: any, user: User | null) => {
    if (user) {
        const keyMapping: Record<string, string> = { 'kalina_api_key': 'api_key', 'kalina_voice_mode_voice': 'voice_mode_voice', 'kalina_voice_mode_persona_instruction': 'voice_mode_persona_instruction', 'kalina_voice_mode_tone_instruction': 'voice_mode_tone_instruction', 'kalina_voice_mode_custom_instruction': 'voice_mode_custom_instruction', 'kalina_voice_proactive_mode': 'voice_proactive_mode', 'kalina_voice_recording_enabled': 'voice_recording_enabled', 'kalina_voice_personas': 'voice_personas', 'kalina_voice_persona': 'voice_persona' };
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
        const keyMapping: Record<string, string> = { 'kalina_api_key': 'api_key', 'kalina_voice_mode_voice': 'voice_mode_voice', 'kalina_voice_mode_persona_instruction': 'voice_mode_persona_instruction', 'kalina_voice_mode_tone_instruction': 'voice_mode_tone_instruction', 'kalina_voice_mode_custom_instruction': 'voice_mode_custom_instruction', 'kalina_voice_proactive_mode': 'voice_proactive_mode', 'kalina_voice_recording_enabled': 'voice_recording_enabled', 'kalina_voice_personas': 'voice_personas', 'kalina_voice_persona': 'voice_persona' };
        
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

// Article Conversations
export const getArticleConversation = async (articleUrl: string, user: User | null): Promise<ArticleConversation | undefined> => {
    if (user) {
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
        return data ? {
            id: data.id,
            user_id: data.user_id,
            article_url: data.article_url,
            article_title: data.article_title,
            messages: data.messages || [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        } : undefined;
    }
    return getFromLocalDB<ArticleConversation>(STORES.ARTICLE_CONVERSATIONS, articleUrl);
};
export const saveArticleConversation = async (convo: ArticleConversation, user: User | null) => {
    if (user) {
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
    const { data, error } = await supabase
        .from('public_article_cache')
        .select('title, content')
        .eq('article_url', articleUrl)
        .maybeSingle();
    if (error && error.code !== 'PGRST116') {
        logSupabaseError("Error fetching public article cache", error);
        return null;
    }
    return data;
};

export const savePublicArticleCache = async (articleUrl: string, title: string, content: string): Promise<void> => {
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
const ANON_INTERACTIONS_KEY = 'kalina_anon_interactions';

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

export const getInteractions = async (user: User | null, articleUrls: string[]): Promise<UserArticleInteraction[]> => {
    if (user && articleUrls.length > 0) {
        const { data, error } = await supabase
            .from('user_article_interactions')
            .select('article_url, liked, bookmarked')
            .in('article_url', articleUrls)
            .eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching article interactions", error);
            return [];
        }
        return data as UserArticleInteraction[];
    }
    return getLocalInteractions(articleUrls);
};

export const saveInteraction = async (user: User | null, interaction: UserArticleInteraction) => {
    if (user) {
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

export const clearNotesCache = () => {
    cachedNotesPromise = null;
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
                
                const response = await fetch('/api/db', {
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
                if (!response.ok) throw new Error("Failed to fetch notes");
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
                logSupabaseError("Error fetching notes via proxy", error);
                cachedNotesPromise = null; // Invalidate on error
                return [];
            }
        })();
        
        return cachedNotesPromise;
    }
    const local = await getAllFromLocalDB<Note>(STORES.NOTES);
    return local;
};

export const getNoteById = async (id: string, user: User | null): Promise<Note | null> => {
    if (user) {
        const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
        if (error || !data) return null;
        return {
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
    }
    return getFromLocalDB<Note>(STORES.NOTES, id);
};

export const getRecentNotes = async (user: User | null, limit: number): Promise<Note[]> => {
    const allNotes = await getNotes(user);
    return [...allNotes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
};

export const saveNote = async (note: Note, user: User | null) => {
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
        else clearNotesCache();
    } else {
        await saveToLocalDB(STORES.NOTES, note, note.id);
    }
};

export const deleteNote = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting note", error);
        else clearNotesCache();
    } else {
        await deleteFromLocalDB(STORES.NOTES, id);
    }
};

// --- FINANCE PROFILES ---
export const getFinanceProfiles = async (user: User | null): Promise<FinanceProfile[]> => {
    if (user) {
        const { data, error } = await supabase.from('finance_profiles').select('*').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching finance profiles", error);
            return [];
        }
        return (data || []).map((p): FinanceProfile => ({
            id: p.id,
            user_id: p.user_id,
            name: p.name,
            type: p.type,
            currency: p.currency,
            created_at: p.created_at,
        }));
    }
    return getAllFromLocalDB<FinanceProfile>(STORES.FINANCE_PROFILES);
};

export const saveFinanceProfile = async (profile: FinanceProfile, user: User | null) => {
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
    if (user) {
        const { error } = await supabase.from('finance_profiles').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting finance profile", error);
    } else {
        await deleteFromLocalDB(STORES.FINANCE_PROFILES, id);
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

// --- FINANCE TRANSACTIONS ---
export const getFinanceSummary = async (user: User | null): Promise<{ balance: number, income: number, expense: number, lastTransaction: Transaction | null }> => {
    if (user) {
        // Fetch only required fields to calculate totals, minimizing payload
        const { data, error } = await supabase.from('finance_transactions').select('id, amount, type, transaction_date, category').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching finance summary", error);
            return { balance: 0, income: 0, expense: 0, lastTransaction: null };
        }
        
        const txs = (data || []) as any[];
        const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);
        
        const sortedTxs = [...txs].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        const last = sortedTxs[0] ? { ...sortedTxs[0], description: '' } : null;

        return { balance: income - expense, income, expense, lastTransaction: last };
    }
    
    // Local DB logic
    const all = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
    const income = all.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = all.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const sortedTxs = [...all].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
    return { balance: income - expense, income, expense, lastTransaction: sortedTxs[0] || null };
};

export const getDairySummary = async (user: User | null): Promise<{ due: number, paid: number }> => {
    if (user) {
        const { data, error } = await supabase.from('dairy_entries').select('total_price, note').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching dairy summary", error);
            return { due: 0, paid: 0 };
        }
        
        const entries = data || [];
        const totalAmount = entries.reduce((sum, e) => sum + Number(e.total_price || 0), 0);
        let paidAmount = 0;
        
        for (const entry of entries) {
            if (entry.note && typeof entry.note === 'string' && entry.note.startsWith('{')) {
                try {
                    const parsed = JSON.parse(entry.note);
                    if (parsed._isJsonNote && parsed.isPaid) {
                        paidAmount += Number(entry.total_price || 0);
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }
        return { due: totalAmount - paidAmount, paid: paidAmount };
    }
    
    // local skip for brevity, this uses existing getDairyEntries logic
    const entries = await getDairyEntries(null);
    const totalAmount = entries.reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);
    const paidAmount = entries.filter((e: any) => e.isPaid).reduce((sum, e) => sum + Number(e.totalPrice || 0), 0);
    return { due: totalAmount - paidAmount, paid: paidAmount };
};

export const getTransactions = async (user: User | null, profileId?: string | null): Promise<Transaction[]> => {
    if (user) {
        let query = supabase.from('finance_transactions').select('*').eq('user_id', user.id);
        
        if (profileId) {
            query = query.eq('profile_id', profileId);
        } else if (profileId === null) {
            query = query.is('profile_id', null);
        }

        const { data, error } = await query;
        if (error) {
            logSupabaseError("Error fetching transactions", error);
            return [];
        }
        return (data || []).map((t): Transaction => ({
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
            metadata: t.metadata // Include metadata
        }));
    }
    
    // Local DB logic for filtering
    const all = await getAllFromLocalDB<Transaction>(STORES.FINANCE);
    if (profileId === undefined) return all;
    if (profileId === null) return all.filter(t => !t.profile_id); // Default/Null profile
    return all.filter(t => t.profile_id === profileId);
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
    const local = localStorage.getItem('kalina_last_molecule_ctx');
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
        localStorage.setItem('kalina_last_molecule_ctx', JSON.stringify({ name, settings }));
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
    if (user) {
        const { data, error } = await supabase.from('dairy_items').select('*').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching dairy items", error);
            return [];
        }
        return (data || []).map((item): DairyItem => ({
            id: item.id,
            user_id: item.user_id,
            name: item.name,
            defaultPrice: item.default_price,
            unit: item.unit,
            defaultQuantity: item.default_quantity,
            createdAt: item.created_at,
        }));
    }
    const items = localStorage.getItem('kalina_dairy_items');
    return items ? JSON.parse(items) : [];
};

export const saveDairyItem = async (item: DairyItem, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('dairy_items').upsert({
            id: item.id,
            user_id: user.id,
            name: item.name,
            default_price: item.defaultPrice,
            unit: item.unit,
            default_quantity: item.defaultQuantity,
            created_at: item.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving dairy item", error);
    } else {
        const items = await getDairyItems(null);
        const index = items.findIndex(i => i.id === item.id);
        if (index >= 0) items[index] = item;
        else items.push(item);
        localStorage.setItem('kalina_dairy_items', JSON.stringify(items));
    }
};

export const deleteDairyItem = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('dairy_items').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting dairy item", error);
    } else {
        const items = await getDairyItems(null);
        const filtered = items.filter(i => i.id !== id);
        localStorage.setItem('kalina_dairy_items', JSON.stringify(filtered));
    }
};

export const getDairyEntries = async (user: User | null): Promise<DairyEntry[]> => {
    if (user) {
        const { data, error } = await supabase.from('dairy_entries').select('*').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching dairy entries", error);
            return [];
        }
        return (data || []).map((entry): DairyEntry => {
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
    }
    const entries = localStorage.getItem('kalina_dairy_entries');
    return entries ? JSON.parse(entries) : [];
};

export const saveDairyEntry = async (entry: DairyEntry, user: User | null) => {
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
        localStorage.setItem('kalina_dairy_entries', JSON.stringify(entries));
    }
};

export const deleteDairyEntry = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('dairy_entries').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting dairy entry", error);
    } else {
        const entries = await getDairyEntries(null);
        const filtered = entries.filter(e => e.id !== id);
        localStorage.setItem('kalina_dairy_entries', JSON.stringify(filtered));
    }
};

export const getDairyPayments = async (user: User | null): Promise<DairyPayment[]> => {
    if (user) {
        const { data, error } = await supabase.from('dairy_payments').select('*').eq('user_id', user.id);
        if (error) {
            logSupabaseError("Error fetching dairy payments", error);
            return [];
        }
        return (data || []).map((payment): DairyPayment => ({
            id: payment.id,
            user_id: payment.user_id,
            itemId: payment.item_id || 'general',
            date: payment.payment_date,
            amount: payment.amount,
            notes: payment.note,
            createdAt: payment.created_at,
        }));
    }
    const payments = localStorage.getItem('kalina_dairy_payments');
    return payments ? JSON.parse(payments) : [];
};

export const saveDairyPayment = async (payment: DairyPayment, user: User | null) => {
    if (user) {
        // Attempt insert with item_id first, as expected by schema
        let payload: any = {
            id: payment.id,
            user_id: user.id,
            item_id: payment.itemId === 'general' ? null : payment.itemId,
            amount: payment.amount,
            payment_date: payment.date,
            note: payment.notes,
            created_at: payment.createdAt || new Date().toISOString(),
        };
        
        const { error } = await supabase.from('dairy_payments').upsert(payload, { onConflict: 'id' });
        if (error) logSupabaseError("Error saving dairy payment", error);
    } else {
        const payments = await getDairyPayments(null);
        const index = payments.findIndex(p => p.id === payment.id);
        if (index >= 0) payments[index] = payment;
        else payments.push(payment);
        localStorage.setItem('kalina_dairy_payments', JSON.stringify(payments));
    }
};

export const deleteDairyPayment = async (id: string, user: User | null) => {
    if (user) {
        const { error } = await supabase.from('dairy_payments').delete().eq('id', id);
        if (error) logSupabaseError("Error deleting dairy payment", error);
    } else {
        const payments = await getDairyPayments(null);
        const filtered = payments.filter(p => p.id !== id);
        localStorage.setItem('kalina_dairy_payments', JSON.stringify(filtered));
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
        if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
                await saveDairyItem(item, user);
            }
        }
        if (data.entries && Array.isArray(data.entries)) {
            for (const entry of data.entries) {
                await saveDairyEntry(entry, user);
            }
        }
        if (data.payments && Array.isArray(data.payments)) {
            for (const payment of data.payments) {
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

// Translator Usage
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

export const exportData = async (user: User | null): Promise<string> => {
    const data: any = {};
    
    data.conversations = await getConversations(user);
    data.notes = await getNotes(user);
    data.financeProfiles = await getFinanceProfiles(user);
    data.vehicles = await getVehicles(user);
    data.transactions = await getTransactions(user);
    data.translatorUsage = await getTranslatorUsage(user);
    
    // Local storage items
    data.dairyItems = localStorage.getItem('kalina_dairy_items');
    data.dairyEntries = localStorage.getItem('kalina_dairy_entries');
    data.dairyPayments = localStorage.getItem('kalina_dairy_payments');
    data.uiPreferences = localStorage.getItem('kalina_ui_preferences');
    data.anonInteractions = localStorage.getItem('kalina_anon_interactions');
    
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
    
    if (data.dairyItems) localStorage.setItem('kalina_dairy_items', data.dairyItems);
    if (data.dairyEntries) localStorage.setItem('kalina_dairy_entries', data.dairyEntries);
    if (data.dairyPayments) localStorage.setItem('kalina_dairy_payments', data.dairyPayments);
    if (data.uiPreferences) localStorage.setItem('kalina_ui_preferences', data.uiPreferences);
    if (data.anonInteractions) localStorage.setItem('kalina_anon_interactions', data.anonInteractions);
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