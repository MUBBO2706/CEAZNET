
import React from 'react';

export type ChatModel = 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-2.5-flash-lite';
export type Tool = 'smart' | 'webSearch' | 'thinking' | 'urlReader' | 'chemistry';
export type View = 'home' | 'translator' | 'molecule-viewer' | 'live-conversation' | 'explore' | 'article-reader' | 'settings' | 'notes' | 'finance' | 'dairy' | 'about' | 'features' | 'voice-history' | 'voice-settings' | 'gallery' | 'support' | 'privacy-policy' | 'terms-of-service' | 'not-found';

export interface SupportConversation {
    id: string;
    user_id: string;
    type: 'chat' | 'mail';
    subject?: string;
    status: 'open' | 'closed' | 'pending';
    created_at: string;
    updated_at: string;
}

export interface SupportMessage {
    id: string;
    conversation_id: string;
    sender_id?: string;
    sender_type: 'user' | 'admin';
    message: string;
    attachment_url?: string;
    attachment_name?: string;
    attachment_type?: string;
    is_read: boolean;
    read_at?: string;
    created_at: string;
}

export interface DairyItem {
    id: string;
    user_id?: string;
    name: string; // e.g., "Milk", "Newspaper"
    defaultPrice: number;
    unit: string; // "L", "kg", "pkt", "unit"
    defaultQuantity?: number;
    color?: string;
    createdAt?: string;
}

export interface DairyEntry {
    id: string;
    user_id?: string;
    itemId: string;
    date: string; // YYYY-MM-DD
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    isPaid: boolean;
    paymentId?: string; // ID of the payment that marked this entry as paid
    notes?: string;
    createdAt?: string;
}

export interface DairyPayment {
    id: string;
    user_id?: string;
    itemId: string; // Which item this payment is for (or null for general, but let's stick to item-wise for now)
    date: string;
    amount: number;
    notes?: string;
    createdAt?: string;
}

export type TaskType = 'WEB_SEARCH' | 'URL_PRE_PROCESS' | 'CHEMISTRY' | 'CREATOR_INQUIRY' | 'CAPABILITIES_INQUIRY' | 'GENERAL_THINKING' | 'SIMPLE_CHAT' | 'URL_PRE_PROCESS' | 'MOLECULE_PRE_PROCESS';

export type MessageRole = 'user' | 'model';

export type VoiceName = 'Elara' | 'Finn' | 'Clara' | 'Alistair' | 'Chloe' | 'Silas' | 'Fleur' | 'Marcus' | 'Sophie' | 'Leo' | 'Lina' | 'Axel' | 'Isabella' | 'Liam' | 'Kenna' | 'Julien' | 'Aurora' | 'Gideon' | 'Seraphina' | 'Solomon' | 'Genevieve' | 'Dante' | 'Victoria' | 'Felix' | 'Penelope' | 'Owen' | 'Amelia' | 'Kai' | 'Nico' | 'Elias';

export interface UIPreferences {
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: 'sans' | 'serif' | 'mono' | 'inter' | 'playfair' | 'quicksand';
    layoutDensity: 'comfortable' | 'compact';
    borderRadius?: 'small' | 'medium' | 'large' | 'full'; 
    showTimeBubble?: boolean;
}

export interface ModelInfo {
  id: ChatModel;
  name: string;
  description: string;
}

export interface Web {
  uri?: string;
  title?: string;
}

export interface GroundingChunk {
  web?: Web;
  favicon?: string; // Base64 encoded favicon
}

export interface ThoughtStep {
  phase: string;
  step: string;
  concise_step: string;
}

export interface SearchTiming {
    planning: number; // Query generation
    searching: number; // Network retrieval (estimated)
    reading: number; // Content processing/delay
    total: number;
}

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioChunks?: string[];
  startTime?: number;
  endTime?: number;
}

export interface EmailPreviewData {
    recipient: string;
    subject: string;
    body: string;
}

export interface NewsArticle {
    source: {
        name: string;
        url: string;
    };
    author: string | null;
    title: string;
    description: string | null;
    url: string;
    image: string | null;
    publishedAt: string;
    content: string | null;
    formattedContent?: {
        markdown: string;
    };
    views?: number;
    likes?: number;
    bookmarks?: number;
    category?: string;
}

export interface UserArticleInteraction {
    article_url: string;
    liked: boolean;
    bookmarked: boolean;
}

export interface MoleculeViewerState {
    showHydrogens: boolean;
    showLabels: boolean;
    showElectrons: boolean;
    showElectronCloud: boolean;
    autoRotate: boolean;
    style: 'ballAndStick' | 'sticks' | 'wireframe' | 'spaceFilling';
}

export interface UserMolecule {
    id: string;
    user_id?: string;
    name: string;
    data?: MoleculeData;
    settings: MoleculeViewerState;
    isFavorite: boolean;
    lastViewedAt: string;
    createdAt: string;
}

export interface MoleculeData {
    atoms: {
        element: string;
        x: number;
        y: number;
        z: number;
    }[];
    bonds: {
        from: number;
        to: number;
        order: number;
    }[];
    molecularFormula?: string;
    molecularWeight?: string;
    iupacName?: string;
    charge?: number;
    complexity?: number;
    hBondDonorCount?: number;
    hBondAcceptorCount?: number;
    rotatableBondCount?: number;
    topologicalPolarSurfaceArea?: number;
    heavyAtomCount?: number;
    xLogP?: number;
    exactMass?: number;
    monoisotopicMass?: number;
    canonicalSMILES?: string;
    isomericSMILES?: string;
    inchi?: string;
    inchiKey?: string;
}

export interface Note {
    id: string;
    user_id?: string;
    title: string;
    content: string;
    tags: string[];
    isPinned: boolean;
    colorTheme: 'default' | 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'pink';
    createdAt: string;
    updatedAt: string;
}

export interface FinanceProfile {
    id: string;
    user_id?: string;
    name: string; // e.g., "Personal", "Business", "Goa Trip"
    type: 'personal' | 'business' | 'savings' | 'project';
    currency: string;
    created_at: string;
}

export interface Vehicle {
    id: string;
    user_id?: string;
    name: string;
    type: 'car' | 'bike';
    number_plate: string;
    current_odometer: number;
}

export interface GalleryItem {
    id: string;
    user_id?: string;
    url: string; // tg:// url
    type: 'image' | 'video' | 'document' | 'audio' | 'other';
    mimeType: string;
    filename: string;
    size: number;
    createdAt: string;
    width?: number;
    height?: number;
    duration?: number; // for videos
    isPlaceholder?: boolean;
    uploadProgress?: number;
}

export interface TransactionMetadata {
    vehicle_id?: string;
    vehicle_name?: string;
    odometer_reading?: number;
    fuel_liters?: number;
    distance_driven?: number; // Calculated delta
    mileage?: number; // Calculated average
}

export interface Transaction {
    id: string;
    user_id?: string;
    profile_id?: string; // Links to FinanceProfile. If null/undefined, belongs to "Default"
    amount: number;
    type: 'expense' | 'income' | 'transfer';
    category: string;
    description: string;
    payment_method: string;
    transaction_date: string;
    created_at?: string;
    metadata?: TransactionMetadata | null; // For Fuel tracking etc
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: string; // Added to track message creation time
  images?: {
      base64: string;
      mimeType: string;
  }[];
  file?: {
      base64: string;
      mimeType: string;
      name: string;
      size: number;
  };
  attachedNote?: Note | null;
  url?: string;
  modelUsed?: ChatModel;
  sources?: GroundingChunk[];
  searchTiming?: SearchTiming;
  thoughts?: ThoughtStep[];
  searchQueries?: string[];
  webSearchMessage?: string;
  thinkingDuration?: number;
  isAnalyzingImage?: boolean;
  isAnalyzingFile?: boolean;
  analysisCompleted?: boolean;
  isPlanning?: boolean;
  memoryUpdated?: boolean;
  inputTokens?: number; // User prompt tokens
  outputTokens?: number; // Model response tokens
  systemTokens?: number;
  generationTime?: number;
  isMoleculeRequest?: boolean;
  isFetchingMolecule?: boolean;
  molecule?: MoleculeData;
  moleculeNameForAnimation?: string;
  audioBase64?: string;
  isProcessingUrl?: boolean;
  isFetchingScreenshot?: boolean;
  urlForAnimation?: string;
}

export interface AppError {
    message: string;
}

export interface Suggestion {
  text: string;
  prompt: string;
  icon?: React.ReactNode;
}

export interface Conversation {
  id: string;
  user_id?: string; // For Supabase
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  isPinned?: boolean;
  isGeneratingTitle?: boolean;
  isVoiceConversation?: boolean;
  audio_url?: string | null;
}

export interface ArticleConversation {
  id: string; // UUID for remote, article URL for local
  user_id?: string;
  article_url: string;
  article_title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}


export interface VoicePersona {
    id: string;
    title: string;
    icon: string;
    prompt: string;
    voice: VoiceName | 'user-selectable';
}

export interface UserProfile {
  id?: string; // Supabase user ID
  name: string | null; // Legacy, prefer full_name
  full_name: string | null;
  avatar_url: string | null;
  is_suspended?: boolean;
}


export interface ConsoleLog {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

// Types for the Developer Console
export type ConsoleMode = 'auto' | 'manual' | 'disabled';

export interface ConsoleLogEntry {
    id: string;
    timestamp: string;
    level: 'log' | 'warn' | 'error';
    message: string;
    stack?: string;
}

export interface TokenLog {
    id: string;
    timestamp: string;
    source: 'Chat' | 'Memory/Suggestions' | 'Translator' | 'Planner' | 'Code Analyzer' | 'Convo Summarizer' | 'AI Debugger' | 'Title Generation' | 'Router' | 'QueryGen' | 'ThoughtGen';
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    details?: string;
}

export interface YouTubeVideo {
    videoId: string;
    title: string;
    thumbnailUrl: string;
}

export interface RouterPlan {
    task: TaskType;
    isComplex: boolean;
    needsCodeContext: boolean;
}
