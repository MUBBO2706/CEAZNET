import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { supportService } from '../services/supportService';
import { SupportConversation, SupportMessage } from '../types';
import { MessageCircle, Mail, Send, ArrowLeft, Loader2, Info, Plus, Clock, Ticket, HeadphonesIcon, Paperclip, Bold, Italic, Underline, Link2, List, ImageIcon, Check, CheckCheck, FileText, Download, X, Reply, Forward, MoreVertical, Braces, Trash2, Eye, ArrowUp, Pencil, Strikethrough, Heading1, ListOrdered, Quote, Code, RemoveFormatting, User, Sparkles, Bot, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { getFileUrlFromTelegram, uploadFileToTelegram, UploadMetadata } from '../services/telegramStorage';
import { supabase } from '../services/supabaseClient';
import { getAiClient } from '../services/aiClient';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from './ToastSystem';
import { useGlobalModal } from './core/GlobalModalProvider';
import { CustomDropdown } from './CustomDropdown';

export const KNOWN_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-3-flash',
    'gemini-3-pro'
];

export const SUPPORT_AI_MODELS = KNOWN_MODELS.map(model => ({
    id: model,
    name: model,
    description: model
}));

export const SparkleStarIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className || "w-5 h-5"}>
        <defs>
            <linearGradient id="blueGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="40%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
        </defs>
        <path fill="url(#blueGlowGradient)" d="M12 0C12 8 16 12 24 12C16 12 12 16 12 24C12 16 8 12 0 12C8 12 12 8 12 0Z" />
    </svg>
);

export const CustomAiSparkleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className || "w-5 h-5"} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C12 7.52 16.48 12 22 12C16.48 12 12 16.48 12 22C12 16.48 7.52 12 2 12C7.52 12 12 7.52 12 2Z" fill="#3b82f6" />
    </svg>
);

interface ParsedAttachment {
    url: string;
    name: string;
    type: string;
    isImage: boolean;
}

function parseSupportAttachments(rawUrl?: string | null, rawName?: string | null, rawType?: string | null): ParsedAttachment[] {
    if (!rawUrl || !rawUrl.trim()) return [];
    let urls: string[] = [];
    if (rawUrl.trim().startsWith('[') && rawUrl.trim().endsWith(']')) {
        try {
            urls = JSON.parse(rawUrl);
        } catch {
            urls = rawUrl.split(',').map(s => s.trim());
        }
    } else {
        urls = rawUrl.split(',').map(s => s.trim());
    }

    let names: string[] = [];
    if (rawName && rawName.trim()) {
        if (rawName.trim().startsWith('[') && rawName.trim().endsWith(']')) {
            try {
                names = JSON.parse(rawName);
            } catch {
                names = rawName.split(',').map(s => s.trim());
            }
        } else {
            names = rawName.split(',').map(s => s.trim());
        }
    }

    let types: string[] = [];
    if (rawType && rawType.trim()) {
        if (rawType.trim().startsWith('[') && rawType.trim().endsWith(']')) {
            try {
                types = JSON.parse(rawType);
            } catch {
                types = rawType.split(',').map(s => s.trim());
            }
        } else {
            types = rawType.split(',').map(s => s.trim());
        }
    }

    return urls.filter(Boolean).map((u, idx) => {
        const itemType = types[idx] || (types.length === 1 ? types[0] : '') || '';
        const itemName = names[idx] || (names.length === 1 && urls.length === 1 ? names[0] : '') || (u.startsWith('tg://') ? `attachment_${idx + 1}` : u.split('/').pop() || `file_${idx + 1}`);
        const isImg = itemType.startsWith('image/') || /\.(jpeg|jpg|png|gif|webp|svg|bmp|heic)$/i.test(itemName) || /\.(jpeg|jpg|png|gif|webp|svg|bmp|heic)$/i.test(u);
        return {
            url: u,
            name: itemName,
            type: itemType,
            isImage: isImg
        };
    });
}

const SingleAttachmentItem = ({ att, isUser, isChat }: { att: ParsedAttachment, isUser: boolean, isChat: boolean }) => {
    const [realUrl, setRealUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        if (!att.url) return;
        if (att.url.startsWith('tg://')) {
            setIsLoading(true);
            getFileUrlFromTelegram(att.url).then(url => {
                if (url && url !== '__NOT_FOUND__' && url !== '__TOO_LARGE__') {
                    setRealUrl(url);
                }
            }).finally(() => {
                setIsLoading(false);
            });
        } else {
            setRealUrl(att.url);
        }
    }, [att.url]);

    const renderPreviewModal = () => {
        return createPortal(
            <AnimatePresence>
                {isPreviewOpen && realUrl && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 p-4"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPreviewOpen(false); }}
                    >
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPreviewOpen(false); }} className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors z-[100000]">
                            <X className="w-6 h-6" />
                        </button>
                        <img src={realUrl} alt={att.name || 'Preview'} className="max-w-full max-h-full object-contain pointer-events-auto rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                        <a href={realUrl} download={att.name || 'attachment'} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 p-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-[100000]" onClick={(e) => e.stopPropagation()}>
                            <Download className="w-5 h-5" />
                            <span className="hidden sm:inline font-medium pr-1">Download</span>
                        </a>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
        );
    };

    if (isChat) {
        return (
            <>
            <div 
                className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border max-w-full transition-all cursor-pointer group shadow-sm ${
                    isUser 
                        ? 'bg-blue-700/50 hover:bg-blue-600/60 border-blue-500/30 text-white' 
                        : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-900 dark:text-white'
                }`} 
                onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    if (realUrl) {
                        if (att.isImage) setIsPreviewOpen(true);
                        else window.open(realUrl, '_blank');
                    }
                }}
            >
                <div className={`w-9 h-9 rounded-md overflow-hidden flex items-center justify-center shrink-0 relative ${isUser ? 'bg-blue-500/40 text-white' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                    {att.isImage && realUrl ? (
                         <>
                         <img src={realUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="thumbnail" />
                         <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                         </div>
                         </>
                    ) : isLoading ? (
                         <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                    ) : (
                         <FileText className="w-4 h-4" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1 py-0.5">
                    <span className={`text-[11.5px] font-medium truncate ${isUser ? 'text-white' : 'text-neutral-900 dark:text-white'}`}>{att.name || 'File'}</span>
                    <span className={`text-[9.5px] truncate font-medium ${isUser ? 'text-blue-100/80' : 'text-neutral-400 dark:text-neutral-500'}`}>
                        {att.isImage ? 'CLICK TO VIEW' : (att.type?.split('/')[1]?.toUpperCase() || 'FILE')}
                    </span>
                </div>
            </div>
            {renderPreviewModal()}
            </>
        );
    }

    return (
        <>
        <div 
            className={`flex items-center gap-3 p-2 pr-3.5 rounded-xl border transition-all cursor-pointer group shadow-sm ${
                isUser 
                    ? 'bg-neutral-50/90 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/80' 
                    : 'bg-neutral-50/90 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
            }`} 
            onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                if (realUrl) {
                    if (att.isImage) setIsPreviewOpen(true);
                    else window.open(realUrl, '_blank');
                }
            }}
        >
            <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 relative">
                {att.isImage && realUrl ? (
                     <>
                     <img src={realUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="thumbnail" />
                     <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Eye className="w-4 h-4 text-white drop-shadow" />
                     </div>
                     </>
                ) : isLoading ? (
                     <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                ) : (
                     <FileText className="w-4 h-4" />
                )}
            </div>
            <div className="flex flex-col flex-1 min-w-0 py-0.5">
                <span className="text-[12.5px] font-semibold truncate text-neutral-900 dark:text-neutral-100">{att.name || 'File Attachment'}</span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium truncate uppercase mt-0.5">
                    {att.isImage ? 'CLICK TO VIEW' : (att.type?.split('/')[1] || 'FILE')}
                </span>
            </div>
            <div className="shrink-0 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
                <Download className="w-3.5 h-3.5" />
            </div>
        </div>
        {renderPreviewModal()}
        </>
    );
};

const ResolvedAttachment = ({ msg, isUser, isChat }: { msg: SupportMessage, isUser: boolean, isChat: boolean }) => {
    const attachments = parseSupportAttachments(msg.attachment_url, msg.attachment_name, msg.attachment_type);
    if (attachments.length === 0) return null;

    if (isChat) {
        return (
            <div className={`mt-2 ${attachments.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-1.5 min-w-[200px]' : 'flex flex-col gap-1.5'}`}>
                {attachments.map((att, index) => (
                    <SingleAttachmentItem key={`${att.url}-${index}`} att={att} isUser={isUser} isChat={true} />
                ))}
            </div>
        );
    }

    return (
        <div className={`mt-3 ${attachments.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl w-full' : 'flex flex-wrap gap-2 w-fit'}`}>
            {attachments.map((att, index) => (
                <SingleAttachmentItem key={`${att.url}-${index}`} att={att} isUser={isUser} isChat={false} />
            ))}
        </div>
    );
};

export const EMAIL_TEMPLATES = [
    {
        category: 'AI Assistant & Features',
        items: [
            { name: 'Inaccurate Response', subject: 'Report: Inaccurate AI Response', content: "Hi Ceaznet Support,\n\nThe AI provided an inaccurate or unhelpful response regarding [Topic].\n\nPrompt details:\n\nExpected response:\n\nActual response:\n\nPlease help improve this." },
            { name: 'Voice Mode Issue', subject: 'Issue with Voice Persona Mode', content: "Hi Team,\n\nI am experiencing an issue with Voice Mode.\n\nIssue details (e.g., audio cutting out, wrong language, persona not following instructions):\n\nDevice/Browser:\n\nThanks," },
            { name: 'Translation Error', subject: 'Translation Error in Dictionary', content: "Hi,\n\nI noticed an incorrect translation in the dictionary/translator feature.\n\nOriginal Text:\nLanguage:\nIncorrect Output:\nSuggested Correction (if known):\n\nRegards," }
        ]
    },
    {
        category: 'Data & Finance',
        items: [
            { name: 'Finance Sync Issue', subject: 'Issue syncing finance data', content: "Hi Support,\n\nI am having trouble syncing or importing my finance transactions.\n\nFormat used (CSV, manual upload):\nError message (if any):\n\nPlease look into this." },
            { name: 'Export Data Request', subject: 'Request to export account data', content: "Hello,\n\nI would like to request an export of all my notes, chats, and finance data associated with my account (Email: [Your Email]).\n\nHow do I proceed?" }
        ]
    },
    {
        category: 'Science & Molecules',
        items: [
            { name: 'Molecule Rendering Bug', subject: 'Bug: Molecule Viewer not rendering', content: "Hi Team,\n\nThe 3D Molecule viewer failed to render a specific compound.\n\nSMILES/Compound name: \n\nBrowser details:\n\nThanks!" }
        ]
    },
    {
        category: 'Account & Billing',
        items: [
            { name: 'Subscription Issue', subject: 'Subscription/Billing Issue', content: "Hi Support,\n\nI have a question/issue regarding my subscription or a recent charge.\n\nDetails:\n\nPlease let me know the process.\n\nThanks," },
            { name: 'Change Email', subject: 'Request to change account email', content: "Hi,\n\nI would like to change the email address associated with my account from [Old Email] to [New Email].\n\nThanks," }
        ]
    },
    {
        category: 'Feedback & Ideas',
        items: [
            { name: 'Feature Request', subject: 'Feature Request: [Feature Name]', content: "Hi Team,\n\nI would love to see this feature added to Ceaznet:\n\nWhy this would be useful:\n\nThanks!" }
        ]
    }
];

function htmlToMarkdown(html: string): string {
    if (!html) return '';
    if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();
    try {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Process code blocks
        temp.querySelectorAll('pre').forEach(pre => {
            pre.innerHTML = '\n```\n' + (pre.textContent || '') + '\n```\n';
        });

        // Process blockquotes
        temp.querySelectorAll('blockquote').forEach(bq => {
            bq.innerHTML = '\n> ' + (bq.textContent || '').replace(/\n/g, '\n> ') + '\n';
        });

        // Process ordered lists
        temp.querySelectorAll('ol').forEach(ol => {
            const items = ol.querySelectorAll(':scope > li');
            items.forEach((li, idx) => {
                li.innerHTML = `\n${idx + 1}. ${li.innerHTML.trim()}\n`;
            });
        });

        // Process unordered lists
        temp.querySelectorAll('ul').forEach(ul => {
            const items = ul.querySelectorAll(':scope > li');
            items.forEach(li => {
                li.innerHTML = `\n- ${li.innerHTML.trim()}\n`;
            });
        });

        let text = temp.innerHTML;
        text = text.replace(/<div><br><\/div>/gi, '\n');
        text = text.replace(/<div>/gi, '\n');
        text = text.replace(/<\/div>/gi, '');
        text = text.replace(/<p>/gi, '');
        text = text.replace(/<\/p>/gi, '\n\n');
        text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
        text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
        text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');
        text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
        text = text.replace(/<u>(.*?)<\/u>/gi, '_$1_');
        text = text.replace(/<s>(.*?)<\/s>/gi, '~$1~');
        text = text.replace(/<strike>(.*?)<\/strike>/gi, '~$1~');
        text = text.replace(/<del>(.*?)<\/del>/gi, '~$1~');
        text = text.replace(/<h3>(.*?)<\/h3>/gi, '\n### $1\n');
        text = text.replace(/<h2>(.*?)<\/h2>/gi, '\n## $1\n');
        text = text.replace(/<h1>(.*?)<\/h1>/gi, '\n# $1\n');
        text = text.replace(/<ul>/gi, '\n');
        text = text.replace(/<\/ul>/gi, '\n');
        text = text.replace(/<ol>/gi, '\n');
        text = text.replace(/<\/ol>/gi, '\n');
        text = text.replace(/<li>/gi, '- ');
        text = text.replace(/<\/li>/gi, '\n');
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<a [^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&lt;/g, '<');
        text = text.replace(/&gt;/g, '>');
        text = text.replace(/&amp;/g, '&');
        return text.trim();
    } catch {
        return html.trim();
    }
}

export const SupportView: React.FC<{ 
    setSupportHeaderState?: (state: { title: string | null; onBack?: () => void }) => void;
    userProfile?: any;
}> = ({ setSupportHeaderState, userProfile }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { alert: globalAlert } = useGlobalModal();
  const [activeTab, setActiveTab] = useState<'chat' | 'mail'>(() => {
      return (localStorage.getItem('supportActiveTab') as 'chat' | 'mail') || 'chat';
  });
  const [conversations, setConversations] = useState<(SupportConversation & {unread_count?: number, last_message?: string, last_message_time?: string})[]>([]);
  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showTemplatesList, setShowTemplatesList] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [isDeletingConvo, setIsDeletingConvo] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingChannelRef = useRef<any>(null);
  const lastUserTypingRef = useRef<number>(0);
  const isFetchingConversationsRef = useRef<boolean>(false);
  const activeMessageFetchIdRef = useRef<string | null>(null);
  const lastFetchConversationsTimeRef = useRef<number>(0);
  const [platformSettings, setPlatformSettings] = useState<{support_email: string, platform_logo_url: string}>({ support_email: 'Support@ceaznet.com', platform_logo_url: '/logo.png' });
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);

  // AI Refinement & Portals State
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
      return localStorage.getItem('support-ai-model') || KNOWN_MODELS[0];
  });
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [templateBtnRect, setTemplateBtnRect] = useState<DOMRect | null>(null);

  const richEditorRef = useRef<HTMLDivElement>(null);
  const createTicketEditorRef = useRef<HTMLDivElement>(null);
  const createTemplateBtnRef = useRef<HTMLButtonElement>(null);
  const replyTemplateBtnRef = useRef<HTMLButtonElement>(null);

  const [activeFormats, setActiveFormats] = useState<{
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
      h3?: boolean;
      unorderedList?: boolean;
      orderedList?: boolean;
      quote?: boolean;
      code?: boolean;
  }>({});

  const checkActiveFormats = useCallback(() => {
      const activeRef = isComposing ? createTicketEditorRef : richEditorRef;
      if (!activeRef.current) return;
      try {
          const isBold = document.queryCommandState('bold');
          const isItalic = document.queryCommandState('italic');
          const isUnderline = document.queryCommandState('underline');
          const isStrikethrough = document.queryCommandState('strikeThrough');
          const isUnorderedList = document.queryCommandState('insertUnorderedList');
          const isOrderedList = document.queryCommandState('insertOrderedList');
          const sel = window.getSelection();
          let isH3 = false;
          let isQuote = false;
          let isCode = false;
          if (sel && sel.rangeCount > 0) {
              let node: Node | null = sel.getRangeAt(0).startContainer;
              while (node && node !== activeRef.current) {
                  if (node.nodeName === 'H3') isH3 = true;
                  if (node.nodeName === 'BLOCKQUOTE') isQuote = true;
                  if (node.nodeName === 'PRE') isCode = true;
                  node = node.parentNode;
              }
          }
          setActiveFormats({
              bold: isBold,
              italic: isItalic,
              underline: isUnderline,
              strikethrough: isStrikethrough,
              unorderedList: isUnorderedList,
              orderedList: isOrderedList,
              h3: isH3,
              quote: isQuote,
              code: isCode,
          });
      } catch (e) {
          // ignore selection state errors
      }
  }, [isComposing]);

  useEffect(() => {
      const handleSelectionChange = () => {
          if (
              document.activeElement === richEditorRef.current || richEditorRef.current?.contains(document.activeElement) ||
              document.activeElement === createTicketEditorRef.current || createTicketEditorRef.current?.contains(document.activeElement)
          ) {
              checkActiveFormats();
          } else {
              setActiveFormats({});
          }
      };
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => {
          document.removeEventListener('selectionchange', handleSelectionChange);
      };
  }, [checkActiveFormats]);

  const getFormatBtnClass = (isActive: boolean) =>
      `p-1.5 rounded transition-all select-none shrink-0 ${
          isActive
              ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-300 dark:border-indigo-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 border border-transparent'
      }`;

  const applyRichFormat = (type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'h3' | 'unorderedList' | 'orderedList' | 'quote' | 'code' | 'link' | 'clear') => {
      const activeRef = isComposing ? createTicketEditorRef : richEditorRef;
      if (activeRef.current) {
          activeRef.current.focus();
      }
      if (type === 'h3') {
          document.execCommand('formatBlock', false, '<h3>');
      } else if (type === 'quote') {
          document.execCommand('formatBlock', false, '<blockquote>');
      } else if (type === 'code') {
          document.execCommand('formatBlock', false, '<pre>');
      } else if (type === 'unorderedList') {
          document.execCommand('insertUnorderedList', false);
      } else if (type === 'orderedList') {
          document.execCommand('insertOrderedList', false);
      } else if (type === 'link') {
          const url = prompt('Enter website URL:', 'https://');
          if (url) {
              document.execCommand('createLink', false, url);
          }
      } else if (type === 'clear') {
          document.execCommand('removeFormat', false);
      } else if (type === 'bold') {
          document.execCommand('bold', false);
      } else if (type === 'italic') {
          document.execCommand('italic', false);
      } else if (type === 'underline') {
          document.execCommand('underline', false);
      } else if (type === 'strikethrough') {
          document.execCommand('strikeThrough', false);
      }
      
      if (activeRef.current) {
          setNewMessage(activeRef.current.innerHTML);
      }
      setTimeout(checkActiveFormats, 10);
  };

  const handleRefineWithAI = async () => {
      const activeRef = isComposing ? createTicketEditorRef : richEditorRef;
      const rawContent = activeRef.current?.innerText || (activeRef.current?.innerHTML ? htmlToMarkdown(activeRef.current.innerHTML) : '') || newMessage || '';
      if (!rawContent.trim()) {
          addToast("Please write a draft message first to refine with AI.", "info");
          return;
      }

      setIsRefining(true);
      try {
          const ai = getAiClient();
          const systemInstruction = `You are a professional writing and customer support assistant.
Your task is to refine, polish, and structure the user's draft message for a support ticket or reply.
Guidelines:
1. Accurately preserve all issue details, questions, error codes, and user intent.
2. Elevate tone to be clear, polite, structured, and professional.
3. Structure with clean formatting, short paragraphs, and markdown bullet points (- list item) or numbered lists (1. list item) if there are multiple steps or details.
4. Correct all grammar, spelling, and sentence structure.
5. Return ONLY the refined message content. Do NOT include conversational commentary, meta text, or introductory notes like "Here is your refined draft:".`;

          const response = await ai.models.generateContent({
              model: selectedAiModel,
              contents: rawContent.trim(),
              config: {
                  systemInstruction,
                  temperature: 0.3
              }
          });

          const refinedText = response.text?.trim();
          if (refinedText) {
              setNewMessage(refinedText);
              if (activeRef.current) {
                  activeRef.current.innerText = refinedText;
              }
              addToast("Draft refined successfully with AI!", "success");
          }
      } catch (err: any) {
          console.error("Failed to refine with AI:", err);
          addToast(err?.message || "Failed to refine with AI. Please check your API key.", "error");
      } finally {
          setIsRefining(false);
      }
  };

  const insertFormatting = (type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'h3' | 'list' | 'orderedList' | 'quote' | 'code' | 'link' | 'clear') => {
      let textarea = document.activeElement as HTMLTextAreaElement | null;
      if (!textarea || !textarea.classList.contains('support-composer-textarea')) {
          textarea = document.querySelector('.support-composer-textarea') as HTMLTextAreaElement | null;
      }
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const selectedText = text.substring(start, end);

      let replacement = '';
      let cursorOffset = 0;

      switch (type) {
          case 'bold':
              replacement = `**${selectedText || 'bold text'}**`;
              cursorOffset = selectedText ? replacement.length : 2;
              break;
          case 'italic':
              replacement = `*${selectedText || 'italic text'}*`;
              cursorOffset = selectedText ? replacement.length : 1;
              break;
          case 'underline':
              replacement = `<u>${selectedText || 'underlined text'}</u>`;
              cursorOffset = selectedText ? replacement.length : 3;
              break;
          case 'strikethrough':
              replacement = `~~${selectedText || 'strikethrough text'}~~`;
              cursorOffset = selectedText ? replacement.length : 2;
              break;
          case 'h3':
              replacement = `\n### ${selectedText || 'Heading'}\n`;
              cursorOffset = replacement.length;
              break;
          case 'list':
              if (selectedText) {
                  replacement = selectedText.split('\n').map(line => `- ${line}`).join('\n');
              } else {
                  replacement = '\n- item';
              }
              cursorOffset = replacement.length;
              break;
          case 'orderedList':
              if (selectedText) {
                  replacement = selectedText.split('\n').map((line, idx) => `${idx + 1}. ${line}`).join('\n');
              } else {
                  replacement = '\n1. item';
              }
              cursorOffset = replacement.length;
              break;
          case 'quote':
              if (selectedText) {
                  replacement = selectedText.split('\n').map(line => `> ${line}`).join('\n');
              } else {
                  replacement = '\n> quote';
              }
              cursorOffset = replacement.length;
              break;
          case 'code':
              replacement = `\`\`\`\n${selectedText || 'code here'}\n\`\`\``;
              cursorOffset = selectedText ? replacement.length : 4;
              break;
          case 'link':
              replacement = `[${selectedText || 'link text'}](https://example.com)`;
              cursorOffset = selectedText ? replacement.length : 1;
              break;
          case 'clear':
              replacement = selectedText.replace(/[*_~`>#]/g, '').replace(/<\/?u>/g, '');
              cursorOffset = replacement.length;
              break;
          default:
              break;
      }

      const newValue = text.substring(0, start) + replacement + text.substring(end);
      setNewMessage(newValue);

      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }, 0);
  };

  const handleEditMessage = (msgId: string, currentText: string) => {
    setEditingMsgId(msgId);
    setEditingText(currentText);
    setActiveMenuMsgId(null);
  };

  const handleSaveEditedMessage = async (msgId: string) => {
    if (!editingText.trim()) return;
    try {
      await supportService.updateMessage(msgId, editingText);
      setEditingMsgId(null);
      setEditingText('');
      addToast("Message updated successfully", "success");
    } catch (err) {
      console.error("Failed to update message", err);
      addToast("Failed to update message", "error");
    }
  };

  const handleDeleteMessageClick = (msgId: string) => {
    setMessageToDelete(msgId);
    setActiveMenuMsgId(null);
  };

  const handleConfirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    setIsDeletingMsg(true);
    try {
      await supportService.deleteMessage(messageToDelete);
      setMessageToDelete(null);
      addToast("Message deleted successfully", "success");
    } catch (err) {
      console.error("Failed to delete message", err);
      addToast("Failed to delete message", "error");
    } finally {
      setIsDeletingMsg(false);
    }
  };

  useEffect(() => {
     async function fetchSettings() {
         try {
             const { data, error } = await supabase.from('platform_settings').select('setting_key, setting_value');
             if (data && !error) {
                 const newSettings = { support_email: 'Support@ceaznet.com', platform_logo_url: '/logo.png' };
                 data.forEach((row: any) => {
                     let val = row.setting_value;
                     if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
                         val = val.slice(1, -1);
                     }
                     if (row.setting_key === 'support_email') newSettings.support_email = val || 'Support@ceaznet.com';
                     if (row.setting_key === 'platform_logo_url') newSettings.platform_logo_url = val || '/logo.png';
                 });
                 setPlatformSettings(newSettings);
             }
         } catch (err) {
             console.error("Error fetching platform settings", err);
         }
     }
     fetchSettings();
  }, []);
  
  const avatarUrl = userProfile?.avatar_url 
    ? userProfile.avatar_url 
    : `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userProfile?.full_name || user?.email || 'A')}`;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalNode(document.getElementById('floating-header-actions-portal'));
  }, []);

  useEffect(() => {
    localStorage.setItem('supportActiveTab', activeTab);
  }, [activeTab]);

  const activeConversationRef = useRef<SupportConversation | null>(null);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
    if (activeConversation) {
        localStorage.setItem('supportActiveConversationId', activeConversation.id);
    } else {
        localStorage.removeItem('supportActiveConversationId');
    }
  }, [activeConversation]);

  useEffect(() => {
    if (user?.id) {
      loadConversations();
      const unsub = supportService.subscribeToConversations(user.id, (payload) => {
          if (payload?.eventType === 'DELETE' && payload?.table === 'support_conversations') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                  setConversations(prev => prev.filter(c => c.id !== deletedId));
                  setActiveConversation(prev => prev?.id === deletedId ? null : prev);
              }
          }
          // Simply reload to get updated unread counts safely without closure staleness
          loadConversations(true);
      });
      return () => unsub();
    }
  }, [user?.id]);

  useEffect(() => {
     const convoId = activeConversation?.id;
     if (convoId) {
         const channel = supabase.channel(`support_typing_${convoId}`);
         typingChannelRef.current = channel;
         channel.on('broadcast', { event: 'typing' }, (payload) => {
             if (payload.payload?.user_type === 'admin') {
                 setAdminTyping(true);
                 if (typingTimer.current) clearTimeout(typingTimer.current);
                 typingTimer.current = setTimeout(() => setAdminTyping(false), 3000);
             }
         }).subscribe();
         return () => {
             if (typingTimer.current) clearTimeout(typingTimer.current);
             supabase.removeChannel(channel);
             typingChannelRef.current = null;
         }
     }
  }, [activeConversation?.id]);

  const handleUserTyping = () => {
      if (typingChannelRef.current) {
          const now = Date.now();
          if (now - lastUserTypingRef.current > 1500) {
              lastUserTypingRef.current = now;
              typingChannelRef.current.send({
                  type: 'broadcast',
                  event: 'typing',
                  payload: { user_type: 'user' }
              }).catch(console.error);
          }
      }
  };

  useEffect(() => {
    const convoId = activeConversation?.id;
    if (convoId) {
      loadMessages(convoId);
      const unsub = supportService.subscribeToMessages(convoId, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          loadConversations(true);
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          loadConversations(true);
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id || payload.new?.id;
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
          loadConversations(true);
        }
      });
      return () => unsub();
    } else {
      setMessages([]);
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    if (activeConversation) {
      const updated = conversations.find(c => c.id === activeConversation.id);
      if (updated && (updated.status !== activeConversation.status || updated.updated_at !== activeConversation.updated_at)) {
        setActiveConversation(updated);
      }
    }
  }, [conversations, activeConversation]);

  useEffect(() => {
    if (activeConversation && user) {
        const hasUnreadAdminMessags = messages.some(m => m.sender_type === 'admin' && !m.is_read);
        if (hasUnreadAdminMessags) {
            supportService.markMessagesAsRead(activeConversation.id, user.id);
            setMessages(prev => prev.map(m => m.sender_type === 'admin' ? { ...m, is_read: true } : m));
            setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, unread_count: 0 } : c));
        }
    }
  }, [messages, activeConversation, user]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (setSupportHeaderState) {
        if (activeConversation || isComposing) {
            setSupportHeaderState({
                title: "Support",
                onBack: () => { navigate('/support'); }
            });
        } else {
            setSupportHeaderState({ title: null });
        }
    }
  }, [activeConversation, isComposing, setSupportHeaderState, navigate]);

  useEffect(() => {
    return () => {
        if (setSupportHeaderState) setSupportHeaderState({ title: null });
    };
  }, [setSupportHeaderState]);

  const supportId = useMemo(() => {
     const parts = location.pathname.split('/');
     return parts.length >= 3 && parts[1] === 'support' && parts[2] ? parts[2] : null;
  }, [location.pathname]);

  useEffect(() => {
     if (!supportId) {
        if (activeConversation !== null) setActiveConversation(null);
        if (isComposing) setIsComposing(false);
     } else if (conversations.length > 0) {
        const convo = conversations.find(c => c.id === supportId);
        if (convo && activeConversation?.id !== supportId) {
           setActiveConversation(convo);
           setActiveTab(convo.type);
        }
     }
  }, [supportId, conversations]);

  const loadConversations = async (silent = false) => {
    const now = Date.now();
    if (isFetchingConversationsRef.current || (now - lastFetchConversationsTimeRef.current < 400)) {
        return;
    }
    isFetchingConversationsRef.current = true;
    lastFetchConversationsTimeRef.current = now;
    try {
      if (!silent) setLoading(true);
      const data = await supportService.getConversations(user!.id);
      
      setConversations(prev => {
          let newData = [...data];
          if (activeConversationRef.current) {
              newData = newData.map(c => c.id === activeConversationRef.current?.id ? { ...c, unread_count: 0 } : c);
          }
          return newData;
      });

      if (!silent) {
          const chats = data.filter(c => c.type === 'chat' || c.type === 'mail');
          const savedActiveId = localStorage.getItem('supportActiveConversationId');
          if (savedActiveId) {
              const selected = chats.find(c => c.id === savedActiveId);
              if (selected) {
                  setActiveConversation(selected);
                  setActiveTab(selected.type);
              }
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      isFetchingConversationsRef.current = false;
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (id: string, silent = false) => {
    if (activeMessageFetchIdRef.current === id) {
        return;
    }
    activeMessageFetchIdRef.current = id;
    try {
      const data = await supportService.getMessages(id);
      setMessages(prev => {
          if (!silent) {
              setTimeout(() => scrollToBottom(true), 50);
          } else {
              if (data.length > prev.length) {
                  // Only scroll if new messages arrived
                  setTimeout(() => scrollToBottom(true), 50);
              }
          }
          return data;
      });
    } catch (e) {
      console.error(e);
    } finally {
      activeMessageFetchIdRef.current = null;
    }
  };

  const scrollToBottom = (force = false) => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (force || isNearBottom) {
        messagesContainerRef.current.scrollTop = scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  const handleConfirmDelete = async () => {
      if (!conversationToDelete) return;
      
      const convoId = conversationToDelete;
      setIsDeletingConvo(true);
      try {
          await supportService.deleteConversation(convoId);
          // If we reach here, it successfully deleted in DB (count > 0)
          setConversations(prev => prev.filter(c => c.id !== convoId));
          if (activeConversation?.id === convoId) {
              setActiveConversation(null);
              navigate('/support', { replace: true });
          }
          addToast("Deleted successfully.", "success");
      } catch (err: any) {
          console.error("Failed to delete conversation", err);
          if (err.message && err.message.includes("database permissions")) {
              addToast("Delete blocked. Please add DELETE RLS policy in Supabase SQL editor.", "error");
          } else {
              addToast("Failed to delete. Wait 2 seconds or check permissions.", "error");
          }
      } finally {
          setIsDeletingConvo(false);
          setConversationToDelete(null);
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !user) return;

    try {
      setSending(true);
      let convoId = activeConversation?.id;

      if (!convoId && activeTab === 'chat') {
        const newConvo = await supportService.createConversation(user.id, 'chat');
        setActiveConversation(newConvo);
        setConversations(prev => [newConvo, ...prev]);
        convoId = newConvo.id;
      }

      if (!convoId && activeTab === 'mail') {
        if (!newSubject.trim()) {
           globalAlert("Please enter a subject for the mail.", { type: 'warning' });
           setSending(false);
           return;
        }
        const newConvo = await supportService.createConversation(user.id, 'mail', newSubject);
        setConversations(prev => [newConvo, ...prev]);
        navigate(`/support/${newConvo.id}`);
        convoId = newConvo.id;
        setNewSubject('');
      }

      if (convoId) {
        let attachmentData;
        if (attachment) {
            setIsUploadingAttachment(true);
             const metadata: UploadMetadata = {
                 userId: user?.id || 'N/A',
                 userName: user?.user_metadata?.full_name || user?.user_metadata?.name || 'Support User',
                 userEmail: user?.email || 'N/A',
                 uploadedAt: new Date().toISOString(),
                 fileType: 'SUPPORT ATTACHMENT',
                 mimeType: attachment.type || 'N/A',
                 fileSize: `${(attachment.size / (1024 * 1024)).toFixed(2)} MB (${attachment.size.toLocaleString()} bytes)`
             };
             const url = await uploadFileToTelegram(attachment, attachment.name, metadata);
             attachmentData = {
                 url,
                 name: attachment.name,
                 type: attachment.type
             };
        }

        await supportService.sendMessage(convoId, user.id, newMessage, attachmentData);
        setNewMessage('');
        if (richEditorRef.current) {
            richEditorRef.current.innerHTML = '';
        }
        if (createTicketEditorRef.current) {
            createTicketEditorRef.current.innerHTML = '';
        }
        setAttachment(null);
        setIsUploadingAttachment(false);
        setIsReplying(true);
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (e) {
      console.error(e);
      globalAlert('Failed to send message.', { type: 'danger' });
    } finally {
      setSending(false);
      setIsUploadingAttachment(false);
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setAttachment(e.target.files[0]);
      }
  };

  const filteredConversations = conversations.filter(c => c.type === activeTab);

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'open': return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>;
          case 'closed': return <span className="bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Closed</span>;
          case 'pending': return <span className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Pending</span>;
          default: return null;
      }
  }

  const queryParams = new URLSearchParams(location.search);
  const isGuestSupport = queryParams.get('guest') === 'true';
  const predefinedTopic = queryParams.get('topic') || '';
  const predefinedMessage = queryParams.get('message') || '';
  const predefinedEmail = queryParams.get('email') || '';

  useEffect(() => {
     if (user && isGuestSupport && !isComposing && !activeConversation) {
         setActiveTab('mail');
         setIsComposing(true);
         if (predefinedTopic) setNewSubject(predefinedTopic);
         if (predefinedMessage) setNewMessage(predefinedMessage);
         // Clean URL silently
         const url = new URL(window.location.href);
         url.searchParams.delete('guest');
         url.searchParams.delete('topic');
         url.searchParams.delete('message');
         url.searchParams.delete('email');
         window.history.replaceState({}, document.title, url.pathname + url.search);
     }
  }, [user, isGuestSupport, isComposing, activeConversation, predefinedTopic, predefinedMessage]);

  const [guestEmail, setGuestEmail] = useState(predefinedEmail || (user?.email ?? ''));
  const [guestTopic, setGuestTopic] = useState(predefinedTopic);
  const [guestMessage, setGuestMessage] = useState(predefinedMessage);
  const [guestSending, setGuestSending] = useState(false);
  const [guestSent, setGuestSent] = useState(false);

  const handleGuestSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!guestEmail.trim() || !guestTopic.trim() || !guestMessage.trim()) return;
      setGuestSending(true);
      try {
          // Attempt DB submission first
          try {
              if (user) {
                  const convo = await supportService.createConversation(user.id, 'mail', guestTopic);
                  if (convo) {
                      await supportService.sendMessage(convo.id, user.id, guestMessage);
                  }
              } else {
                  const convo = await supportService.createGuestConversation('mail', guestTopic, guestEmail);
                  if (convo) {
                      await supportService.sendGuestMessage(convo.id, guestMessage);
                  }
              }
          } catch(dbErr) {
              console.error("DB submission failed, falling back to Telegram:", dbErr);
          }

          // Then send via Telegram as a backup / alert
          const { sendTelegramAlert } = await import('../services/telegramStorage');
          const text = `🚨 GUEST SUPPORT REQUEST 🚨\n\nEmail: ${guestEmail}\nSubject: ${guestTopic}\nMessage: ${guestMessage}`;
          const success = await sendTelegramAlert(text);
          if (success) {
              setGuestSent(true);
              addToast("Message sent successfully. We will contact you soon.", "success");
          } else {
              throw new Error("Failed to send");
          }
      } catch (err) {
          addToast("Failed to send. Please try again later.", "error");
      } finally {
          setGuestSending(false);
      }
  };

  if (!user && !isGuestSupport) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center pt-24 bg-neutral-50 dark:bg-black">
        <div className="w-16 h-16 bg-neutral-200/50 dark:bg-neutral-800/50 rounded-full flex items-center justify-center mb-6">
          <HeadphonesIcon className="w-8 h-8 text-neutral-500 dark:text-neutral-400" />
        </div>
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">We're here to help</h2>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">Please sign in to start a live chat or submit a support ticket.</p>
        <button onClick={() => navigate('/home')} className="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full font-medium">Go Home</button>
      </div>
    );
  }

  if (isGuestSupport && !user) {
      if (guestSent) {
          return (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center pt-24 bg-neutral-50 dark:bg-black">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                      <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white mb-2">Message Sent</h2>
                  <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">Our support team has received your message and will get back to you at {guestEmail} as soon as possible.</p>
                  <button onClick={() => navigate('/home')} className="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full font-medium">Return to Home</button>
              </div>
          );
      }

      return (
          <div className="w-full h-full flex flex-col bg-white dark:bg-black overflow-hidden hover:bg-white dark:hover:bg-black transition-colors pt-12 md:pt-0">
              <form onSubmit={handleGuestSubmit} className="w-full max-w-full mx-auto flex flex-col h-full bg-white dark:bg-black overflow-hidden py-6 md:py-8 px-4 md:px-0">
                  {/* Compose Header */}
                  <div className="pb-6 border-b border-neutral-200 dark:border-white/10 flex-shrink-0">
                      <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Create Ticket {!user && <span className="text-sm font-normal text-neutral-500 bg-neutral-100 dark:bg-white/10 px-2 py-0.5 rounded-full ml-2">Guest</span>}</h2>
                      <p className="text-neutral-500 mt-1">Submit a new support request</p>
                  </div>
                  <div className="py-4 border-b border-neutral-100 dark:border-white/5 flex items-center gap-4 text-sm flex-shrink-0">
                      <span className="text-neutral-400 w-16">To</span>
                      <span className="bg-neutral-100 dark:bg-white/10 px-2 py-1 rounded-md text-neutral-700 dark:text-neutral-200 font-medium">Support Team</span>
                  </div>
                  <div className="py-4 border-b border-neutral-100 dark:border-white/5 flex items-center gap-4 text-sm flex-shrink-0">
                      <span className="text-neutral-400 w-16">From</span>
                      <input 
                          type="email" 
                          required
                          readOnly={!!user}
                          className={`flex-1 bg-transparent outline-none font-medium text-neutral-900 dark:text-white placeholder-neutral-400 ${user ? 'opacity-80 cursor-default' : ''}`} 
                          placeholder="Your email address" 
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                      />
                  </div>
                  <div className="py-4 border-b border-neutral-100 dark:border-white/5 flex items-center gap-4 text-sm flex-shrink-0">
                      <span className="text-neutral-400 w-16">Subject</span>
                      <input 
                          type="text" 
                          required
                          className="flex-1 bg-transparent outline-none font-medium text-neutral-900 dark:text-white placeholder-neutral-400" 
                          placeholder="Briefly describe your issue" 
                          value={guestTopic}
                          onChange={(e) => setGuestTopic(e.target.value)}
                      />
                  </div>
                  <div className="py-4 flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar">
                      <textarea 
                          required
                          className="w-full h-full bg-transparent outline-none resize-none text-[15px] text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 leading-relaxed custom-scrollbar min-h-[150px]" 
                          placeholder="Write your message here..."
                          value={guestMessage}
                          onChange={(e) => setGuestMessage(e.target.value)}
                      ></textarea>
                  </div>
                  <div className="py-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-1 text-neutral-400">
                         {/* Guest doesn't support attachments in this version, so no file clip */}
                      </div>
                      <button 
                          type="submit" 
                          disabled={guestSending || !guestEmail.trim() || !guestTopic.trim() || !guestMessage.trim()}
                          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors disabled:opacity-50"
                      >
                          {guestSending ? 'Sending...' : 'Send Message'}
                          {guestSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                  </div>
              </form>
          </div>
      );
  }

  const showSidebar = !activeConversation && !isComposing;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black overflow-hidden hover:bg-white dark:hover:bg-black transition-colors">
      <div className="flex-1 w-full max-w-full mx-auto flex overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={`w-full md:w-[280px] lg:w-[320px] shrink-0 flex-col bg-neutral-50 dark:bg-black md:bg-white md:dark:bg-black border-r border-neutral-200/60 dark:border-white/10 relative z-10 pt-[72px] md:pt-[72px] ${showSidebar ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-1 overflow-y-auto no-scrollbar bg-transparent py-2">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 min-h-[200px] h-full">
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin mb-2" />
                <span className="text-xs font-medium">Loading conversations...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400 min-h-[200px] h-full text-center">
                <p className="text-sm font-medium">No {activeTab} history.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredConversations.map(convo => (
                  <div
                    key={convo.id}
                    onClick={() => { navigate(`/support/${convo.id}`); setIsComposing(false); }}
                    className={`w-full text-left py-4 px-4 transition-all relative group border-b last:border-b-0 border-neutral-100 dark:border-white/5 cursor-pointer ${activeConversation?.id === convo.id ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'bg-transparent hover:bg-neutral-50/50 dark:hover:bg-white/[0.02]'}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        navigate(`/support/${convo.id}`); setIsComposing(false);
                      }
                    }}
                  >
                      {/* Active indicator */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors rounded-r-md ${activeConversation?.id === convo.id ? 'bg-blue-600 dark:bg-blue-500' : 'bg-transparent group-hover:bg-neutral-200 dark:group-hover:bg-neutral-800'}`}></div>
                      
                      <div className="flex justify-between items-start mb-1.5 gap-2 pl-1">
                          <div className="flex flex-row items-center gap-2 max-w-full min-w-0">
                             {getStatusBadge(convo.status)}
                             {activeTab === 'mail' && (
                                <span className="text-[11px] font-mono tracking-wider text-neutral-400 dark:text-neutral-500 uppercase truncate">
                                  #{convo.id.split('-')[0]}
                                </span>
                             )}
                          </div>
                          <span className={`text-[11px] shrink-0 tabular-nums font-medium ${(convo.unread_count ?? 0) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                             {convo.last_message_time ? format(new Date(convo.last_message_time), 'h:mm a') : format(new Date(convo.updated_at), 'MMM d')}
                          </span>
                      </div>
                      
                      <div className="pl-1 flex flex-col relative pb-1">
                          {activeTab === 'mail' ? (
                            <h4 className={`text-[14px] leading-snug line-clamp-1 transition-colors ${activeConversation?.id === convo.id ? 'font-semibold text-blue-900 dark:text-blue-300' : 'font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                              {convo.subject || 'No Subject'}
                            </h4>
                          ) : (
                            <h4 className={`text-[14px] leading-snug line-clamp-1 transition-colors ${activeConversation?.id === convo.id ? 'font-semibold text-blue-900 dark:text-blue-300' : 'font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                              Live Session
                            </h4>
                          )}
                          
                          {/* Last message preview WhatsApp style */}
                          {convo.last_message && (
                             <div className="flex items-center justify-between gap-3 mt-1 min-h-[20px] pr-6">
                                 <p className={`text-[13px] truncate ${(convo.unread_count ?? 0) > 0 ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-500 dark:text-neutral-400'}`}>
                                     {convo.last_message}
                                 </p>
                                 {(convo.unread_count ?? 0) > 0 && (
                                    <span className="bg-blue-600 dark:bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 tabular-nums min-w-[20px] text-center absolute right-0 -top-1">
                                       {convo.unread_count}
                                    </span>
                                 )}
                             </div>
                          )}
                          {!convo.last_message && (
                             <div className="flex justify-between items-center mt-1.5 pr-6">
                                <p className="text-[12px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                                   <Clock className="w-3.5 h-3.5 opacity-70" /> Updated {format(new Date(convo.updated_at), 'h:mm a')}
                                </p>
                             </div>
                          )}

                          <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setConversationToDelete(convo.id);
                              }}
                              className="absolute bottom-0 right-0 text-neutral-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 bg-white/80 dark:bg-black/80 backdrop-blur-sm rounded-md"
                              title="Delete"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Workspace */}
        <div className={`flex-1 flex-col bg-white dark:bg-black overflow-hidden relative ${showSidebar ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Chat/Form Area */}
            {activeTab === 'mail' ? (
                <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-white dark:bg-black relative">
                    <div ref={messagesContainerRef} className={`flex-1 w-full ${!activeConversation ? 'p-4 md:p-6 pt-[76px] md:pt-[56px] pb-2 overflow-hidden flex flex-col' : 'px-2.5 sm:px-4 md:px-5 py-4 pt-[76px] md:pt-[56px] pb-2 overflow-y-auto'}`}>
                        {!activeConversation ? (
                            <div className="w-full max-w-full mx-auto flex flex-col h-full bg-white dark:bg-black overflow-hidden py-2 md:py-0">
                                {/* Compose Header */}
                                <div className="pb-6 border-b border-neutral-200 dark:border-white/10 px-4 md:px-0 flex-shrink-0">
                                    <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">Create Ticket</h2>
                                    <p className="text-neutral-500 mt-1">Submit a new support request</p>
                                </div>
                                <div className="py-4 border-b border-neutral-100 dark:border-white/5 flex items-center gap-4 text-sm px-4 md:px-0 flex-shrink-0">
                                    <span className="text-neutral-400 w-16">To</span>
                                    <span className="bg-neutral-100 dark:bg-white/10 px-2 py-1 rounded-md text-neutral-700 dark:text-neutral-200 font-medium">Support Team</span>
                                </div>
                                <div className="py-4 border-b border-neutral-100 dark:border-white/5 flex items-center gap-4 text-sm px-4 md:px-0 flex-shrink-0">
                                    <span className="text-neutral-400 w-16">Subject</span>
                                    <input 
                                        type="text" 
                                        className="flex-1 bg-transparent outline-none font-medium text-neutral-900 dark:text-white placeholder-neutral-400" 
                                        placeholder="Briefly describe your issue" 
                                        value={newSubject}
                                        onChange={(e) => setNewSubject(e.target.value)}
                                    />
                                </div>
                                 <div className="py-4 flex flex-col gap-4 flex-1 px-4 md:px-0 overflow-y-auto custom-scrollbar relative">
                                     <div
                                         ref={createTicketEditorRef}
                                         contentEditable
                                         onInput={() => {
                                             if (createTicketEditorRef.current) {
                                                 setNewMessage(createTicketEditorRef.current.innerHTML);
                                             }
                                             checkActiveFormats();
                                         }}
                                         onKeyUp={checkActiveFormats}
                                         onMouseUp={checkActiveFormats}
                                         onClick={checkActiveFormats}
                                         onFocus={checkActiveFormats}
                                         onBlur={() => {
                                             setTimeout(() => {
                                                 if (!createTicketEditorRef.current?.contains(document.activeElement)) {
                                                     setActiveFormats({});
                                                 }
                                             }, 150);
                                         }}
                                         className="support-composer-textarea w-full bg-transparent border-none focus:outline-none min-h-[150px] overflow-y-auto text-[15px] text-neutral-800 dark:text-neutral-200 leading-relaxed custom-scrollbar
                                         [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-600 [&_pre]:bg-neutral-100 [&_pre]:dark:bg-neutral-800 [&_pre]:p-2 [&_pre]:rounded [&_pre]:font-mono [&_a]:text-indigo-600 [&_a]:underline"
                                     />
                                     {(!newMessage || !newMessage.trim()) && (
                                         <div
                                             onClick={() => createTicketEditorRef.current?.focus()}
                                             className="absolute top-4 left-0 text-neutral-400 dark:text-neutral-500 pointer-events-none text-sm select-none"
                                         >
                                             Write your message here. You can attach details like screenshots below.
                                         </div>
                                     )}
                                    
                                    {attachment && (
                                        <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-white/5 rounded-xl border border-neutral-200 dark:border-white/5 w-fit shrink-0">
                                            <FileText className="w-5 h-5 text-blue-500" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-neutral-900 dark:text-white max-w-[200px] truncate">{attachment.name}</span>
                                                <span className="text-[11px] text-neutral-500">{(attachment.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                            <button onClick={() => setAttachment(null)} className="ml-2 p-1 text-neutral-400 hover:text-red-500 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="py-4 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between px-4 md:px-0 flex-shrink-0">
                                    <div className="flex-1 flex items-center gap-0.5 sm:gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 min-w-0 mr-2">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleAttachmentChange} 
                                        />
                                        <button type="button" onClick={() => applyRichFormat('bold')} className={getFormatBtnClass(!!activeFormats.bold)} title="Bold"><Bold className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('italic')} className={getFormatBtnClass(!!activeFormats.italic)} title="Italic"><Italic className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('underline')} className={getFormatBtnClass(!!activeFormats.underline)} title="Underline"><Underline className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('strikethrough')} className={getFormatBtnClass(!!activeFormats.strikethrough)} title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
                                        
                                        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-0.5 shrink-0"></div>

                                        <button type="button" onClick={() => applyRichFormat('h3')} className={getFormatBtnClass(!!activeFormats.h3)} title="Heading"><Heading1 className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('unorderedList')} className={getFormatBtnClass(!!activeFormats.unorderedList)} title="Bullet List"><List className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('orderedList')} className={getFormatBtnClass(!!activeFormats.orderedList)} title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('quote')} className={getFormatBtnClass(!!activeFormats.quote)} title="Quote"><Quote className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('code')} className={getFormatBtnClass(!!activeFormats.code)} title="Code Block"><Code className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('link')} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 transition-colors" title="Insert Link"><Link2 className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => applyRichFormat('clear')} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 transition-colors" title="Clear Formatting"><RemoveFormatting className="w-4 h-4" /></button>

                                        <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-0.5 shrink-0"></div>

                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 transition-colors" title="Attach file"><Paperclip className="w-4 h-4" /></button>
                                        
                                        <button 
                                            type="button" 
                                            ref={createTemplateBtnRef}
                                            onClick={() => {
                                                if (createTemplateBtnRef.current) {
                                                    setTemplateBtnRect(createTemplateBtnRef.current.getBoundingClientRect());
                                                }
                                                setShowTemplatesList(!showTemplatesList);
                                            }}
                                            className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 transition-colors flex items-center justify-center" 
                                            title="Insert Template"
                                        >
                                            <Braces className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                        <div className="relative min-w-0 max-w-[140px] sm:max-w-[170px]">
                                            <CustomDropdown
                                                options={KNOWN_MODELS}
                                                value={selectedAiModel}
                                                onChange={(val) => {
                                                    setSelectedAiModel(val);
                                                    localStorage.setItem('support-ai-model', val);
                                                }}
                                                triggerClassName="!h-[28px] !p-1 !px-2 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg !text-[10.5px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow shadow-sm truncate"
                                            />
                                        </div>

                                        <motion.button 
                                            layout
                                            type="button"
                                            whileHover={!isRefining && (newMessage.trim() || createTicketEditorRef.current?.innerText?.trim()) ? { scale: 1.05 } : {}}
                                            whileTap={!isRefining && (newMessage.trim() || createTicketEditorRef.current?.innerText?.trim()) ? { scale: 0.95 } : {}}
                                            onClick={handleRefineWithAI}
                                            disabled={isRefining}
                                            title="Refine draft with AI"
                                            className={`relative overflow-hidden flex items-center justify-center transition-all rounded-full font-medium text-[12px] h-[32px] w-[32px] p-0 shrink-0 border ${
                                                isRefining 
                                                    ? 'bg-neutral-900 border-transparent text-white cursor-wait shadow-sm scale-[0.98]' 
                                                    : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 shadow-sm'
                                            }`}
                                        >
                                            <AnimatePresence mode="wait">
                                                {isRefining ? (
                                                    <motion.div 
                                                        key="generating"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="flex flex-row items-center justify-center z-10 w-full"
                                                    >
                                                        <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-neutral-700 dark:bg-white rounded-full" />
                                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-neutral-700 dark:bg-white rounded-full" />
                                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-neutral-700 dark:bg-white rounded-full" />
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <motion.div 
                                                        key="idle"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="flex flex-row items-center justify-center z-10"
                                                    >
                                                        <CustomAiSparkleIcon className="w-5 h-5" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            
                                            {isRefining && (
                                                <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden pointer-events-none rounded-full">
                                                    <motion.div 
                                                        className="absolute mix-blend-screen filter blur-[8px] opacity-90 rounded-full"
                                                        style={{ width: '140%', height: '200%', background: '#38bdf8', left: '-25%', top: '-50%' }}
                                                        animate={{ 
                                                            x: ['0%', '15%', '-5%', '0%'], 
                                                            y: ['0%', '25%', '-10%', '0%'],
                                                            scale: [1, 1.25, 0.9, 1],
                                                            rotate: [0, 90, 180, 360]
                                                        }}
                                                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                    />
                                                    <motion.div 
                                                        className="absolute mix-blend-screen filter blur-[10px] opacity-80 rounded-full"
                                                        style={{ width: '120%', height: '160%', background: '#818cf8', right: '-20%', bottom: '-40%' }}
                                                        animate={{ 
                                                            x: ['0%', '-15%', '5%', '0%'], 
                                                            y: ['0%', '-20%', '10%', '0%'],
                                                            scale: [1, 1.15, 0.95, 1],
                                                            rotate: [0, -90, -180, -360]
                                                        }}
                                                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                    />
                                                </div>
                                            )}
                                        </motion.button>

                                        <button 
                                            type="button"
                                            onClick={handleSendMessage}
                                            disabled={sending || (!newMessage.trim() && !attachment) || !newSubject.trim()}
                                            className="relative overflow-hidden flex items-center justify-center gap-1.5 px-4 transition-all text-white rounded-full font-medium text-[12px] h-[32px] w-auto min-w-[70px] shrink-0 border shadow-sm bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <AnimatePresence mode="wait">
                                                {sending ? (
                                                    <motion.div 
                                                        key="sending"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="flex flex-row items-center justify-center z-10 w-full"
                                                    >
                                                        <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-white dark:bg-neutral-900 rounded-full" />
                                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-white dark:bg-neutral-900 rounded-full" />
                                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-white dark:bg-neutral-900 rounded-full" />
                                                        </div>
                                                    </motion.div>
                                                ) : (
                                                    <motion.div key="send" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5">
                                                        <Send className="w-3.5 h-3.5" />
                                                        <span>{isUploadingAttachment ? 'Uploading...' : 'Send'}</span>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                           <div className="w-full max-w-full mx-auto mt-0 space-y-4 mb-4">
                               {/* Subject Header */}
                               <div className="mb-4 flex flex-col items-start pb-4 md:pb-6 border-b border-neutral-200 dark:border-white/10">
                                   <div className="flex items-center gap-3 w-full">
                                       <div className="flex-1">
                                           <div className="flex items-center gap-3">
                                               <h2 className="text-xl font-semibold text-neutral-900 dark:text-white leading-snug truncate">{activeConversation.subject || 'Support Ticket'}</h2>
                                           </div>
                                           <div className="flex items-center gap-2 mt-2">
                                                {getStatusBadge(activeConversation.status)}
                                                <span className="text-xs text-neutral-500 font-medium tracking-wide uppercase">ID: {activeConversation.id.split('-')[0]}</span>
                                           </div>
                                       </div>
                                   </div>
                               </div>

                               {/* Message Thread */}
                               <div className="space-y-4 mb-4">
                               {messages.map((msg) => {
                                   const isUser = msg.sender_type === 'user';
                                   const userName = isUser ? (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User') : 'Ceaznet Support';
                                   const emailStr = isUser ? (user?.email || 'user@example.com') : platformSettings.support_email;

                                   return (
                                       <div 
                                           key={msg.id} 
                                           className={`w-full pb-3.5 mb-3.5 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0 last:mb-0 last:pb-0 ${
                                               !isUser ? 'pl-2.5 sm:pl-3 border-l-2 border-l-indigo-500' : 'pl-2.5 sm:pl-3 border-l-2 border-l-neutral-300 dark:border-l-neutral-700'
                                           }`}
                                       >
                                           <div className="flex items-start gap-3 p-0 mb-2">
                                               <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                                                   !isUser 
                                                       ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' 
                                                       : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700'
                                               }`}>
                                                   {isUser ? (
                                                       avatarUrl ? (
                                                           <img src={avatarUrl} alt="User Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                                       ) : (
                                                           <User className="w-5 h-5 text-neutral-600 dark:text-neutral-300" />
                                                       )
                                                   ) : (
                                                       platformSettings.platform_logo_url ? (
                                                           <img src={platformSettings.platform_logo_url} alt="Support Team" referrerPolicy="no-referrer" className="w-full h-full object-contain p-1" />
                                                       ) : (
                                                           <HeadphonesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                       )
                                                   )}
                                               </div>
                                               <div className="flex flex-col flex-1 justify-center min-w-0">
                                                   <div className="flex justify-between items-start">
                                                       <div className="flex flex-col min-w-0">
                                                           <div className="flex items-baseline gap-2 flex-wrap">
                                                               <span className="text-[13px] font-bold text-neutral-900 dark:text-neutral-100">
                                                                   {userName}
                                                               </span>
                                                               <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                                                                   - {format(new Date(msg.created_at), 'MM/dd/yyyy HH:mm')}
                                                               </span>
                                                           </div>
                                                           <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1.5">
                                                               <span className="text-[9px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-bold">
                                                                   {isUser ? 'From:' : 'To:'}
                                                               </span>
                                                               <span>{"<"}{emailStr}{">"}</span>
                                                           </span>
                                                       </div>
                                                       <div className="relative shrink-0 z-30">
                                                           <button 
                                                               onClick={() => setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id)}
                                                               className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1 rounded-md shrink-0"
                                                               title="More options"
                                                           >
                                                               <MoreVertical className="w-4 h-4" />
                                                           </button>
                                                           {activeMenuMsgId === msg.id && (
                                                               <>
                                                                   <div 
                                                                       className="fixed inset-0 z-10" 
                                                                       onClick={() => setActiveMenuMsgId(null)}
                                                                   />
                                                                   <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-[#121212] rounded-xl shadow-xl border border-neutral-100 dark:border-neutral-800 py-1.5 z-20 origin-top-right">
                                                                       {isUser ? (
                                                                           <>
                                                                               <button 
                                                                                   onClick={() => handleEditMessage(msg.id, msg.message)}
                                                                                   className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors flex items-center gap-2"
                                                                               >
                                                                                   <Pencil className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                                                                                   Edit
                                                                               </button>
                                                                               <button 
                                                                                   onClick={() => handleDeleteMessageClick(msg.id)}
                                                                                   className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2"
                                                                               >
                                                                                   <Trash2 className="w-3.5 h-3.5" />
                                                                                   Delete
                                                                               </button>
                                                                           </>
                                                                       ) : (
                                                                           <div className="px-3 py-2 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium whitespace-nowrap">
                                                                               Cannot edit replies
                                                                           </div>
                                                                       )}
                                                                   </div>
                                                               </>
                                                           )}
                                                       </div>
                                                   </div>
                                               </div>
                                           </div>

                                           {/* Message Body - Left aligned under header/logo without empty indent */}
                                           {editingMsgId === msg.id ? (
                                               <div className="mt-2 flex flex-col gap-2">
                                                   <textarea
                                                       value={editingText}
                                                       onChange={(e) => setEditingText(e.target.value)}
                                                       className="w-full p-2.5 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-neutral-900 dark:text-neutral-100 resize-none min-h-[85px]"
                                                   />
                                                   <div className="flex items-center gap-2 self-end">
                                                       <button
                                                           onClick={() => { setEditingMsgId(null); setEditingText(''); }}
                                                           className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                                                       >
                                                           Cancel
                                                       </button>
                                                       <button
                                                           onClick={() => handleSaveEditedMessage(msg.id)}
                                                           className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                                                       >
                                                           Save
                                                       </button>
                                                   </div>
                                               </div>
                                           ) : (
                                               <div className="mt-3 text-[14px] sm:text-[15px] text-neutral-800 dark:text-neutral-200 leading-[1.7] markdown-body">
                                                   <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{msg.message}</ReactMarkdown>
                                               </div>
                                           )}

                                           {msg.attachment_url && (
                                               <div className="mt-3">
                                                   <ResolvedAttachment msg={msg} isUser={isUser} isChat={false} />
                                               </div>
                                           )}
                                       </div>
                                   )
                               })}
                               </div>

                               {/* Reply Box was here */}

                            </div>
                        )}
                    </div>
                    {/* Fixed Composer Wrapper */}
                    {activeConversation && activeConversation.status !== 'closed' ? (
                        <div 
                            className="w-full border-t border-neutral-200 dark:border-white/10 p-4 md:p-6 bg-white dark:bg-black shrink-0 relative z-20"
                            style={{ paddingBottom: 'calc(var(--dev-console-padding, 0px) + 0.5rem)' }}
                        >
                            <div className="w-full max-w-full mx-auto">
                                    {!isReplying ? (
                                        <div className="flex gap-4">
                                             <button onClick={() => setIsReplying(true)} className="flex-1 md:flex-none py-3 px-6 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 dark:text-white bg-white dark:bg-black">
                                                 <Reply className="w-4 h-4" /> Reply
                                             </button>
                                             <button onClick={() => setIsReplying(true)} className="flex-1 md:flex-none py-3 px-6 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 dark:text-white bg-white dark:bg-black">
                                                 <Forward className="w-4 h-4" /> Forward
                                             </button>
                                        </div>
                                    ) : (
                                        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-900/80 shadow-sm focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                                             <div className="flex items-center justify-between w-full min-w-0 px-2.5 py-1.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50">
                                                <div className="flex-1 flex items-center gap-0.5 sm:gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 min-w-0">
                                                    <button type="button" onClick={() => applyRichFormat('bold')} className={getFormatBtnClass(!!activeFormats.bold)} title="Bold"><Bold className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('italic')} className={getFormatBtnClass(!!activeFormats.italic)} title="Italic"><Italic className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('underline')} className={getFormatBtnClass(!!activeFormats.underline)} title="Underline"><Underline className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('strikethrough')} className={getFormatBtnClass(!!activeFormats.strikethrough)} title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
                                                    
                                                    <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-0.5 shrink-0"></div>

                                                    <button type="button" onClick={() => applyRichFormat('h3')} className={getFormatBtnClass(!!activeFormats.h3)} title="Heading"><Heading1 className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('unorderedList')} className={getFormatBtnClass(!!activeFormats.unorderedList)} title="Bullet List"><List className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('orderedList')} className={getFormatBtnClass(!!activeFormats.orderedList)} title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('quote')} className={getFormatBtnClass(!!activeFormats.quote)} title="Quote"><Quote className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('code')} className={getFormatBtnClass(!!activeFormats.code)} title="Code Block"><Code className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('link')} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 transition-colors" title="Insert Link"><Link2 className="w-4 h-4" /></button>
                                                    <button type="button" onClick={() => applyRichFormat('clear')} className="p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-300 transition-colors" title="Clear Formatting"><RemoveFormatting className="w-4 h-4" /></button>
                                                </div>

                                                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 border-l border-neutral-200 dark:border-neutral-800 pl-1.5 sm:pl-2 ml-1">
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        className="hidden" 
                                                        onChange={handleAttachmentChange} 
                                                    />
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1 text-xs font-medium shrink-0" title="Attach file">
                                                        <Paperclip className="w-4 h-4" /> <span className="hidden md:inline">Attach</span>
                                                    </button>
                                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1 text-xs font-medium shrink-0" title="Insert Image">
                                                        <ImageIcon className="w-4 h-4" /> <span className="hidden md:inline">Image</span>
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        ref={replyTemplateBtnRef}
                                                        onClick={() => {
                                                            if (replyTemplateBtnRef.current) {
                                                                setTemplateBtnRect(replyTemplateBtnRef.current.getBoundingClientRect());
                                                            }
                                                            setShowTemplatesList(!showTemplatesList);
                                                        }} 
                                                        className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1 text-xs font-medium shrink-0" 
                                                        title="Use Template"
                                                    >
                                                        <Braces className="w-4 h-4" /> <span className="hidden md:inline">Template</span>
                                                    </button>
                                                    <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700 mx-0.5 sm:mx-1 shrink-0"></div>
                                                    <button type="button" onClick={() => setIsReplying(false)} className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded transition-colors shrink-0" title="Close">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                             </div>

                                             <div className="p-3 relative">
                                                 <div
                                                     ref={richEditorRef}
                                                     contentEditable
                                                     onInput={() => {
                                                         if (richEditorRef.current) {
                                                             setNewMessage(richEditorRef.current.innerHTML);
                                                         }
                                                         checkActiveFormats();
                                                     }}
                                                     onKeyUp={checkActiveFormats}
                                                     onMouseUp={checkActiveFormats}
                                                     onClick={checkActiveFormats}
                                                     onFocus={checkActiveFormats}
                                                     onBlur={() => {
                                                         setTimeout(() => {
                                                             if (!richEditorRef.current?.contains(document.activeElement)) {
                                                                 setActiveFormats({});
                                                             }
                                                         }, 150);
                                                     }}
                                                     className="support-composer-textarea w-full min-h-[128px] max-h-[250px] overflow-y-auto bg-transparent border-none focus:outline-none text-[14px] sm:text-[15px] text-neutral-800 dark:text-neutral-200 leading-relaxed custom-scrollbar
                                                     [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-600 [&_pre]:bg-neutral-100 [&_pre]:dark:bg-neutral-800 [&_pre]:p-2 [&_pre]:rounded [&_pre]:font-mono [&_a]:text-indigo-600 [&_a]:underline"
                                                 />
                                                 {(!newMessage || !newMessage.trim()) && (
                                                     <div
                                                         onClick={() => richEditorRef.current?.focus()}
                                                         className="absolute top-3 left-3 text-neutral-400 dark:text-neutral-500 pointer-events-none text-sm select-none"
                                                     >
                                                         Write your response... You can attach details or files below.
                                                     </div>
                                                 )}

                                                 {attachment && (
                                                      <div className="mt-2 flex items-center gap-3 p-2.5 bg-neutral-50 dark:bg-black/40 rounded-xl border border-neutral-200 dark:border-white/5 w-fit">
                                                          <FileText className="w-5 h-5 text-blue-500" />
                                                          <div className="flex flex-col">
                                                             <span className="text-sm font-medium text-neutral-900 dark:text-white max-w-[200px] truncate">{attachment.name}</span>
                                                             <span className="text-[11px] text-neutral-500">{(attachment.size / 1024).toFixed(1)} KB</span>
                                                         </div>
                                                         <button onClick={() => setAttachment(null)} className="ml-2 p-1 text-neutral-400 hover:text-red-500 transition-colors">
                                                             <X className="w-4 h-4" />
                                                         </button>
                                                     </div>
                                                  )}
                                             </div>
                                             <div className="py-2.5 flex items-center justify-between px-3 border-t border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-950/30">
                                                 <div className="relative min-w-0 max-w-[140px] sm:max-w-[170px]">
                                                     <CustomDropdown
                                                         options={KNOWN_MODELS}
                                                         value={selectedAiModel}
                                                         onChange={(val) => {
                                                             setSelectedAiModel(val);
                                                             localStorage.setItem('support-ai-model', val);
                                                         }}
                                                         triggerClassName="!h-[28px] !p-1 !px-2 w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg !text-[10.5px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow shadow-sm truncate"
                                                     />
                                                 </div>

                                                 <div className="flex items-center gap-2 shrink-0">
                                                     <motion.button 
                                                         layout
                                                         type="button"
                                                         whileHover={!isRefining && (newMessage.trim() || richEditorRef.current?.innerText?.trim()) ? { scale: 1.05 } : {}}
                                                         whileTap={!isRefining && (newMessage.trim() || richEditorRef.current?.innerText?.trim()) ? { scale: 0.95 } : {}}
                                                         onClick={handleRefineWithAI}
                                                         disabled={isRefining}
                                                         title="Refine draft with AI"
                                                         className={`relative overflow-hidden flex items-center justify-center transition-all rounded-full font-medium text-[12px] h-[32px] w-[32px] p-0 shrink-0 border ${
                                                             isRefining 
                                                                 ? 'bg-neutral-900 border-transparent text-white cursor-wait shadow-sm scale-[0.98]' 
                                                                 : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 shadow-sm'
                                                         }`}
                                                     >
                                                         <AnimatePresence mode="wait">
                                                             {isRefining ? (
                                                                 <motion.div 
                                                                     key="generating"
                                                                     initial={{ opacity: 0 }}
                                                                     animate={{ opacity: 1 }}
                                                                     exit={{ opacity: 0 }}
                                                                     transition={{ duration: 0.15 }}
                                                                     className="flex flex-row items-center justify-center z-10 w-full"
                                                                 >
                                                                     <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                                         <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-neutral-700 dark:bg-white rounded-full" />
                                                                         <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-neutral-700 dark:bg-white rounded-full" />
                                                                         <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-neutral-700 dark:bg-white rounded-full" />
                                                                     </div>
                                                                 </motion.div>
                                                             ) : (
                                                                 <motion.div 
                                                                     key="idle"
                                                                     initial={{ opacity: 0 }}
                                                                     animate={{ opacity: 1 }}
                                                                     exit={{ opacity: 0 }}
                                                                     transition={{ duration: 0.15 }}
                                                                     className="flex flex-row items-center justify-center z-10"
                                                                 >
                                                                     <CustomAiSparkleIcon className="w-5 h-5" />
                                                                 </motion.div>
                                                             )}
                                                         </AnimatePresence>
                                                         
                                                         {isRefining && (
                                                             <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden pointer-events-none rounded-full">
                                                                 <motion.div 
                                                                     className="absolute mix-blend-screen filter blur-[8px] opacity-90 rounded-full"
                                                                     style={{ width: '140%', height: '200%', background: '#38bdf8', left: '-25%', top: '-50%' }}
                                                                     animate={{ 
                                                                         x: ['0%', '15%', '-5%', '0%'], 
                                                                         y: ['0%', '25%', '-10%', '0%'],
                                                                         scale: [1, 1.25, 0.9, 1],
                                                                         rotate: [0, 90, 180, 360]
                                                                     }}
                                                                     transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                                 />
                                                                 <motion.div 
                                                                     className="absolute mix-blend-screen filter blur-[10px] opacity-80 rounded-full"
                                                                     style={{ width: '120%', height: '160%', background: '#818cf8', right: '-20%', bottom: '-40%' }}
                                                                     animate={{ 
                                                                         x: ['0%', '-15%', '5%', '0%'], 
                                                                         y: ['0%', '-20%', '10%', '0%'],
                                                                         scale: [1, 1.15, 0.95, 1],
                                                                         rotate: [0, -90, -180, -360]
                                                                     }}
                                                                     transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                                 />
                                                             </div>
                                                         )}
                                                     </motion.button>

                                                    <button 
                                                        type="button"
                                                        onClick={handleSendMessage}
                                                        disabled={sending || (!newMessage.trim() && !attachment)}
                                                        className="relative overflow-hidden flex items-center justify-center gap-1.5 px-4 transition-all text-white rounded-full font-medium text-[12px] h-[32px] w-auto min-w-[70px] shrink-0 border shadow-sm bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 dark:text-neutral-900 border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                         <AnimatePresence mode="wait">
                                                             {sending ? (
                                                                 <motion.div 
                                                                     key="sending"
                                                                     initial={{ opacity: 0 }}
                                                                     animate={{ opacity: 1 }}
                                                                     exit={{ opacity: 0 }}
                                                                     transition={{ duration: 0.15 }}
                                                                     className="flex flex-row items-center justify-center z-10 w-full"
                                                                 >
                                                                     <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                                         <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-white dark:bg-neutral-900 rounded-full" />
                                                                         <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-white dark:bg-neutral-900 rounded-full" />
                                                                         <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-white dark:bg-neutral-900 rounded-full" />
                                                                     </div>
                                                                 </motion.div>
                                                             ) : (
                                                                 <motion.div key="send" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex items-center gap-1.5">
                                                                     <Send className="w-3.5 h-3.5" />
                                                                     <span>{isUploadingAttachment ? 'Uploading...' : 'Send'}</span>
                                                                 </motion.div>
                                                             )}
                                                         </AnimatePresence>
                                                     </button>
                                                 </div>
                                             </div>
                                        </div>
                                    )}
                            </div>
                        </div>
                    ) : activeConversation ? (
                        <div 
                            className="absolute left-0 right-0 p-4 md:p-6 bg-white/90 dark:bg-black/90 backdrop-blur-md border-t border-neutral-200 dark:border-white/10"
                            style={{ bottom: 'var(--dev-console-padding, 0px)' }}
                        >
                            <div className="max-w-full w-full mx-auto text-center text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                               This ticket has been closed. Please open a new ticket if you need further assistance.
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-black">
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto w-full absolute inset-0 pb-24 md:pb-28 px-4 md:px-6 pt-[64px] md:pt-[56px]">
                      {!activeConversation ? (
                         <div className="w-full max-w-xl mx-auto text-center pt-24 space-y-4">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HeadphonesIcon className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Live Support</h2>
                            <p className="text-neutral-500 text-sm max-w-sm mx-auto">Send us a message and we'll connect you to a live agent shortly.</p>
                         </div>
                      ) : (
                        <div className="w-full max-w-full mx-auto space-y-6 flex flex-col justify-end min-h-full">
                           {messages.map((msg, i) => {
                              const isUser = msg.sender_type === 'user';
                              const prevMsg = i > 0 ? messages[i-1] : null;
                              const nextMsg = i < messages.length - 1 ? messages[i+1] : null;
                              
                              const sameSenderPrev = prevMsg && prevMsg.sender_type === msg.sender_type;
                              const sameSenderNext = nextMsg && nextMsg.sender_type === msg.sender_type;
                              
                              const sameMinutePrev = prevMsg && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000) && new Date(msg.created_at).getMinutes() === new Date(prevMsg.created_at).getMinutes();
                              const sameMinuteNext = nextMsg && (new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 60000) && new Date(nextMsg.created_at).getMinutes() === new Date(msg.created_at).getMinutes();
                              
                              const isGroupedWithPrev = sameSenderPrev && sameMinutePrev;
                              const isGroupedWithNext = sameSenderNext && sameMinuteNext;
                              
                              const showTime = !isGroupedWithNext;
                              const mt = isGroupedWithPrev ? 'mt-1' : 'mt-4';
                              
                              const roundedClass = isUser 
                                ? `rounded-2xl ${isGroupedWithNext ? 'rounded-br-md' : 'rounded-br-sm'} ${isGroupedWithPrev ? 'rounded-tr-md' : ''}`
                                : `rounded-2xl ${isGroupedWithNext ? 'rounded-bl-md' : 'rounded-bl-sm'} ${isGroupedWithPrev ? 'rounded-tl-md' : ''}`;
    
                              return (
                                <motion.div 
                                   initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                   key={msg.id} 
                                   className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] ${isUser ? 'ml-auto' : 'mr-auto'} ${mt}`}
                                >
                                  <div className={`px-4 py-2.5 ${roundedClass} text-[15px] shadow-sm leading-relaxed ${isUser ? 'bg-blue-600 text-white' : 'bg-white dark:bg-black border border-neutral-100 dark:border-white/5 text-neutral-800 dark:text-neutral-200'}`}>
                                    <p className="whitespace-pre-wrap">{msg.message}</p>
                                    
                                    {msg.attachment_url && (
                                        <ResolvedAttachment msg={msg} isUser={isUser} isChat={true} />
                                    )}
                                  </div>

                                  {showTime && (
                                      <div className={`flex items-center gap-1 mt-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
                                          <span className="text-[10.5px] text-neutral-400 font-medium tracking-wide">
                                              {format(new Date(msg.created_at), 'h:mm a')}
                                          </span>
                                          {isUser && (
                                              msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> : <Check className="w-3.5 h-3.5 text-neutral-400" />
                                          )}
                                      </div>
                                  )}
                                </motion.div>
                              );
                            })}
                            
                            {adminTyping && (
                                <motion.div 
                                   initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                   className="flex flex-col items-start max-w-[85%] mr-auto mt-4"
                                >
                                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-[15px] shadow-sm bg-white dark:bg-black border border-neutral-100 dark:border-white/5 text-neutral-800 dark:text-neutral-200">
                                      <div className="flex gap-1.5 items-center h-4">
                                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                          <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                      </div>
                                  </div>
                                </motion.div>
                            )}
                        </div>
                      )}
                    </div>
    
                    {/* Input Area Overlay */}
                    {activeConversation?.status === 'closed' ? (
                        <div 
                            className="absolute left-0 right-0 p-4 md:p-6 bg-white/90 dark:bg-black/90 backdrop-blur-md border-t border-neutral-200 dark:border-white/10"
                            style={{ bottom: 'var(--dev-console-padding, 0px)' }}
                        >
                            <div className="max-w-full w-full mx-auto text-center text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                               This ticket has been closed. Please open a new ticket if you need further assistance.
                            </div>
                        </div>
                    ) : (
                    <div 
                        className="absolute left-0 right-0 px-4 pt-6 pb-3 md:px-6 md:pb-4 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black"
                        style={{ bottom: 'var(--dev-console-padding, 0px)' }}
                    >
                      <form onSubmit={handleSendMessage} className={`w-full max-w-full mx-auto bg-white dark:bg-black border border-neutral-200 dark:border-neutral-700/60 rounded-[28px] flex flex-col overflow-hidden transition-all focus-within:border-blue-400 dark:focus-within:border-neutral-500 focus-within:ring-4 focus-within:ring-blue-400/10 dark:focus-within:ring-neutral-400/10 mb-2 px-1 py-1`}>
                        
                        {attachment && (
                            <div className="flex items-center justify-between p-3 mx-2 mt-2 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]">{attachment.name}</span>
                                </div>
                                <button type="button" onClick={() => setAttachment(null)} className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <div className="relative flex items-end px-1 pb-1 pt-1">
                          <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => {
                                setNewMessage(e.target.value);
                                handleUserTyping();
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            placeholder={!activeConversation ? "Start a conversation..." : "Message..."}
                            className="flex-1 bg-transparent px-3 py-2 text-[15px] text-neutral-900 dark:text-white placeholder-neutral-400 outline-none resize-none overflow-y-auto custom-scrollbar max-h-[120px] min-h-[40px]"
                            rows={1}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage(e);
                                if (textareaRef.current) {
                                  textareaRef.current.style.height = 'auto';
                                }
                              }
                            }}
                          />
                          <div className="pl-1 pr-1 mb-[2px] shrink-0">
                             <button
                               type="submit"
                               disabled={sending || (!newMessage.trim() && !attachment)}
                               className={`p-1.5 rounded-full transition-all flex items-center justify-center h-[36px] w-[36px] ${(!newMessage.trim() && !attachment) ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600' : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 active:scale-95 shadow-sm'} disabled:opacity-50`}
                             >
                               {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                             </button>
                          </div>
                        </div>
                      </form>
                    </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {portalNode && createPortal(
        <div className="relative pointer-events-auto flex items-center gap-1">
            <button
            onClick={() => { setActiveTab('chat'); setActiveConversation(null); setIsComposing(false); navigate('/support'); }}
            className={`relative flex items-center justify-center h-9 w-9 transition-all focus:outline-none rounded-full ${activeTab === 'chat' ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-600 dark:hover:text-amber-400'}`}
            title="Live Chat"
            >
            <MessageCircle className="h-5 w-5" />
            </button>
            <button
            onClick={() => { setActiveTab('mail'); setActiveConversation(null); setIsComposing(false); navigate('/support'); }}
            className={`relative flex items-center justify-center h-9 w-9 transition-all focus:outline-none rounded-full ${activeTab === 'mail' ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-600 dark:hover:text-amber-400'}`}
            title="Tickets"
            >
            <Ticket className="h-5 w-5" />
            </button>
        </div>,
        portalNode
      )}
      
      {/* FAB */}
      {(!activeConversation && !isComposing) && (
          <button 
              onClick={() => { setActiveConversation(null); setIsComposing(true); navigate('/support'); }}
              className="fixed right-6 z-40 w-16 h-16 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 group md:hidden"
              style={{ bottom: 'calc(var(--dev-console-padding, 0px) + 1.5rem)' }}
              title={activeTab === 'mail' ? "New Ticket" : "New Chat"}
          >
              <Plus className="w-6 h-6" />
          </button>
      )}

      {/* Portaled Template Picker to prevent clipping */}
      {showTemplatesList && templateBtnRect && createPortal(
          <div className="fixed inset-0 z-[9999] overflow-hidden" onClick={() => setShowTemplatesList(false)}>
              <div 
                  onClick={e => e.stopPropagation()}
                  style={{
                      position: 'fixed',
                      bottom: Math.max(16, window.innerHeight - templateBtnRect.top + 8),
                      left: Math.max(16, Math.min(templateBtnRect.left, window.innerWidth - 340)),
                      maxWidth: 'calc(100vw - 32px)',
                      width: 320,
                  }}
                  className="bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              >
                  <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tracking-wide">Select Response Template</span>
                      <button type="button" onClick={() => setShowTemplatesList(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                          <X className="w-3.5 h-3.5" />
                      </button>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1.5 space-y-2">
                      {EMAIL_TEMPLATES.map((cat, i) => (
                          <div key={i} className="space-y-0.5">
                              <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{cat.category}</div>
                              {cat.items.map((item, j) => (
                                  <button
                                      key={j}
                                      type="button"
                                      onClick={() => {
                                          if (isComposing) {
                                              setNewSubject(item.subject);
                                          }
                                          setNewMessage(item.content);
                                          if (createTicketEditorRef.current) {
                                              createTicketEditorRef.current.innerText = item.content;
                                          }
                                          if (richEditorRef.current) {
                                              richEditorRef.current.innerText = item.content;
                                          }
                                          setShowTemplatesList(false);
                                      }}
                                      className="w-full text-left px-2.5 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 rounded-lg transition-colors group flex flex-col"
                                  >
                                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.name}</span>
                                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">{item.subject}</span>
                                  </button>
                              ))}
                          </div>
                      ))}
                  </div>
              </div>
          </div>,
          document.body
      )}

      <ConfirmationModal
          isOpen={!!conversationToDelete}
          onClose={() => {
              setIsDeletingConvo(false);
              setConversationToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title={`Delete ${activeTab === 'mail' ? 'Ticket' : 'Chat'}`}
          message={`Are you sure you want to delete this ${activeTab === 'mail' ? 'ticket' : 'chat'}? This action cannot be undone.`}
          confirmButtonText="Delete"
          confirmButtonVariant="danger"
          isLoading={isDeletingConvo}
      />

      <ConfirmationModal
          isOpen={!!messageToDelete}
          onClose={() => {
              setIsDeletingMsg(false);
              setMessageToDelete(null);
          }}
          onConfirm={handleConfirmDeleteMessage}
          title="Delete Message"
          message="Are you sure you want to delete this message? This action cannot be undone."
          confirmButtonText="Delete"
          confirmButtonVariant="danger"
          isLoading={isDeletingMsg}
      />
    </div>
  );
};
