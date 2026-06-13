import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { supportService } from '../services/supportService';
import { SupportConversation, SupportMessage } from '../types';
import { MessageCircle, Mail, Send, ArrowLeft, Loader2, Info, Plus, Clock, Ticket, HeadphonesIcon, Paperclip, Bold, Italic, List, ImageIcon, Check, CheckCheck, FileText, Download, X, Reply, Forward, MoreVertical, Braces, Trash2, Eye, ArrowUp } from 'lucide-react';
import { getFileUrlFromTelegram, uploadFileToTelegram, UploadMetadata } from '../services/telegramStorage';
import { supabase } from '../services/supabaseClient';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';
import { useToast } from './ToastManager';

const ResolvedAttachment = ({ msg, isUser, isChat }: { msg: SupportMessage, isUser: boolean, isChat: boolean }) => {
    const [realUrl, setRealUrl] = useState('');
    useEffect(() => {
        if (!msg.attachment_url) return;
        if (msg.attachment_url.startsWith('tg://')) {
            getFileUrlFromTelegram(msg.attachment_url).then(url => {
                if (url && url !== '__NOT_FOUND__' && url !== '__TOO_LARGE__') setRealUrl(url);
            });
        } else {
            setRealUrl(msg.attachment_url);
        }
    }, [msg.attachment_url]);

    const isImage = msg.attachment_type?.startsWith('image/') || msg.attachment_name?.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg|heic)$/i);

    const formatSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
                        <img src={realUrl} alt={msg.attachment_name || 'Preview'} className="max-w-full max-h-full object-contain pointer-events-auto" onClick={(e) => e.stopPropagation()} />
                        <a href={realUrl} download={msg.attachment_name || 'attachment'} target="_blank" rel="noreferrer" className="absolute bottom-4 right-4 p-3 bg-blue-600/90 text-white rounded-full hover:bg-blue-600 shadow-lg flex items-center gap-2 transition-all hover:scale-105 z-[100000]" onClick={(e) => e.stopPropagation()}>
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
            <div className={`flex items-center gap-2 mt-2 p-1.5 pr-3 rounded-lg border w-fit ${isUser ? 'bg-blue-700/50 border-blue-500/30 hover:bg-blue-600/60' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'} transition-colors cursor-pointer group`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); realUrl && (isImage ? setIsPreviewOpen(true) : window.open(realUrl, '_blank')); }}>
                <div className={`w-10 h-10 rounded overflow-hidden flex items-center justify-center shrink-0 relative ${isUser ? 'bg-blue-500/50 text-white' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
                    {isImage && realUrl ? (
                         <>
                         <img src={realUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="thumbnail" />
                         <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <Eye className="w-4 h-4 text-white" />
                         </div>
                         </>
                    ) : isImage ? (
                         <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                    ) : (
                         <FileText className="w-4 h-4" />
                    )}
                </div>
                <div className="flex flex-col max-w-[120px]">
                    <span className={`text-xs font-medium truncate ${isUser ? 'text-white' : 'text-neutral-900 dark:text-white'}`}>{msg.attachment_name || 'File'}</span>
                    <span className={`text-[10px] truncate opacity-70 ${isUser ? 'text-blue-100' : 'text-neutral-500 dark:text-neutral-400'}`}>
                        {msg.attachment_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                    </span>
                </div>
            </div>
            {renderPreviewModal()}
            </>
        );
    }

    return (
         <>
         <div className={`flex items-center gap-3 p-2 pr-4 rounded-xl border w-fit mt-3 transition-colors cursor-pointer group ${isUser ? 'bg-neutral-50 dark:bg-black/20 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-black/40' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); realUrl && (isImage ? setIsPreviewOpen(true) : window.open(realUrl, '_blank')); }}>
             <div className={`w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 relative`}>
                 {isImage && realUrl ? (
                      <>
                      <img src={realUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="thumbnail" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-5 h-5 text-white" />
                      </div>
                      </>
                 ) : isImage ? (
                      <Loader2 className="w-5 h-5 animate-spin opacity-50" />
                 ) : (
                      <FileText className="w-5 h-5" />
                 )}
             </div>
             <div className="flex flex-col flex-1 min-w-[120px]">
                 <span className={`text-sm font-medium max-w-[150px] md:max-w-[200px] truncate text-neutral-900 dark:text-white`}>{msg.attachment_name || 'File Attachment'}</span>
                 <span className={`text-[11px] text-neutral-500 truncate`}>
                     {msg.attachment_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                 </span>
             </div>
         </div>
         {renderPreviewModal()}
         </>
    );
}

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

export const SupportView: React.FC<{ 
    setSupportHeaderState?: (state: { title: string | null; onBack?: () => void }) => void;
    userProfile?: any;
}> = ({ setSupportHeaderState, userProfile }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
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
  const [adminTyping, setAdminTyping] = useState(false);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingChannelRef = useRef<any>(null);
  const lastUserTypingRef = useRef<number>(0);
  const [platformSettings, setPlatformSettings] = useState<{support_email: string, platform_logo_url: string}>({ support_email: 'Support@ceaznet.com', platform_logo_url: '/logo.png' });

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
    if (user) {
      loadConversations();
      const unsub = supportService.subscribeToConversations(user.id, (updatedConvo) => {
          // Simply reload to get updated unread counts safely without closure staleness
          loadConversations(true);
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
     if (activeConversation) {
         const channel = supabase.channel(`support_typing_${activeConversation.id}`);
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
  }, [activeConversation]);

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
    if (activeConversation) {
      loadMessages(activeConversation.id);
      const unsub = supportService.subscribeToMessages(activeConversation.id, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      });
      return () => unsub();
    } else {
      setMessages([]);
    }
  }, [activeConversation]);

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
                onBack: () => { setActiveConversation(null); setIsComposing(false); navigate('/support'); }
            });
        } else {
            setSupportHeaderState({ title: null });
        }
    }
    return () => {
        if (setSupportHeaderState) setSupportHeaderState({ title: null });
    }
  }, [activeConversation, isComposing, activeTab, setSupportHeaderState]);

  useEffect(() => {
     const parts = location.pathname.split('/');
     const supportId = parts.length >= 3 && parts[1] === 'support' ? parts[2] : null;
     
     if (supportId && conversations.length > 0) {
        const convo = conversations.find(c => c.id === supportId);
        if (convo && activeConversation?.id !== supportId) {
           setActiveConversation(convo);
           setActiveTab(convo.type);
        }
     } else if (!supportId && activeConversation) {
        setActiveConversation(null);
        setIsComposing(false);
     }
  }, [location.pathname, conversations]);

  const loadConversations = async (silent = false) => {
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
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (id: string, silent = false) => {
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
           alert("Please enter a subject for the mail.");
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
        setAttachment(null);
        setIsUploadingAttachment(false);
        setIsComposing(false);
        setTimeout(() => scrollToBottom(true), 50);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to send message.');
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
              <form onSubmit={handleGuestSubmit} className="max-w-4xl w-full mx-auto flex flex-col h-full bg-white dark:bg-black overflow-hidden py-6 md:py-8 px-4 md:px-0">
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
      <div className="flex-1 w-full max-w-5xl mx-auto flex overflow-hidden relative">
        
        {/* Sidebar */}
        <div className={`w-full md:w-[280px] lg:w-[320px] shrink-0 flex-col bg-neutral-50 dark:bg-black md:bg-white md:dark:bg-black border-r border-neutral-200/60 dark:border-white/10 relative z-10 pt-[72px] md:pt-[72px] ${showSidebar ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-1 overflow-y-auto no-scrollbar bg-transparent py-2">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 text-neutral-400 animate-spin" /></div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center p-8 text-neutral-400">
                <p className="text-sm">No {activeTab} history.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                <AnimatePresence>
                  {filteredConversations.map(convo => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
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
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Main Workspace */}
        <div className={`flex-1 flex-col bg-white dark:bg-black overflow-hidden relative ${showSidebar ? 'hidden md:flex' : 'flex'}`}>
            
            {/* Chat/Form Area */}
            {activeTab === 'mail' ? (
                <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-white dark:bg-black relative">
                    <div ref={messagesContainerRef} className={`flex-1 w-full p-4 md:p-6 pt-[76px] md:pt-[56px] pb-2 ${!activeConversation ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
                        {!activeConversation ? (
                            <div className="max-w-4xl w-full mx-auto flex flex-col h-full bg-white dark:bg-black overflow-hidden py-2 md:py-0">
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
                                <div className="py-4 flex flex-col gap-4 flex-1 px-4 md:px-0 overflow-y-auto custom-scrollbar">
                                    <textarea 
                                        className="w-full h-full bg-transparent outline-none resize-none text-[15px] text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 leading-relaxed custom-scrollbar min-h-[150px]" 
                                        placeholder="Write your message here. You can attach details like screenshots below."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                    ></textarea>
                                    
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
                                    <div className="flex items-center gap-1 text-neutral-400 relative">
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            onChange={handleAttachmentChange} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-lg transition-colors" 
                                            title="Attach file"
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </button>
                                        <button type="button" className="p-2 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-lg transition-colors" title="Bold"><Bold className="w-4 h-4" /></button>
                                        <button type="button" className="p-2 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-lg transition-colors" title="Italic"><Italic className="w-4 h-4" /></button>
                                        
                                        <div className="relative">
                                            <button 
                                                type="button" 
                                                onClick={() => setShowTemplatesList(!showTemplatesList)}
                                                className="p-2 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center" 
                                                title="Insert Template"
                                            >
                                                <Braces className="w-4 h-4" />
                                            </button>
                                            <AnimatePresence>
                                                {showTemplatesList && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                                        className="absolute bottom-full left-0 mb-2 w-64 md:w-80 bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                                                    >
                                                        <div className="max-h-[320px] overflow-y-auto custom-scrollbar py-2">
                                                            {EMAIL_TEMPLATES.map((cat, i) => (
                                                                <div key={i} className="mb-2 last:mb-0">
                                                                    <div className="px-4 py-1.5 text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{cat.category}</div>
                                                                    {cat.items.map((item, j) => (
                                                                        <button
                                                                            key={j}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setNewSubject(item.subject);
                                                                                setNewMessage(item.content);
                                                                                setShowTemplatesList(false);
                                                                            }}
                                                                            className="w-full text-left px-4 py-2 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group flex items-start gap-3"
                                                                        >
                                                                            <div className="flex-1 flex flex-col pt-0.5">
                                                                                <span className="text-[13px] font-semibold text-neutral-900 dark:text-white leading-snug mb-0.5">{item.name}</span>
                                                                                <span className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">{item.subject}</span>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleSendMessage}
                                        disabled={sending || (!newMessage.trim() && !attachment) || !newSubject.trim()}
                                        className="px-6 py-2 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        {sending && isUploadingAttachment ? 'Uploading...' : 'Send Ticket'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                           <div className="max-w-3xl mx-auto mt-0 space-y-4 mb-4">
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
                                   return (
                                       <div key={msg.id} className="flex gap-4">
                                           <div className={`py-4 md:py-6 px-1 w-full flex ${isUser ? '' : 'border-l-[4px] border-indigo-500 pl-4 md:pl-5 ml-[-4px] md:ml-[-5px]'}`}>
                                               <div className="flex gap-3 md:gap-4 w-full">
                                                   <div className="shrink-0 pt-0.5">
                                                       {isUser ? (
                                                            <img src={avatarUrl} alt="User" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shadow-sm bg-neutral-200 dark:bg-neutral-800 ring-1 ring-neutral-200 dark:ring-neutral-800" />
                                                        ) : (
                                                            platformSettings.platform_logo_url ? (
                                                                <img src={platformSettings.platform_logo_url} alt="Support" className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover shadow-sm bg-white dark:bg-neutral-800 ring-1 ring-neutral-200 dark:ring-neutral-800" />
                                                            ) : (
                                                                <div className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold bg-indigo-900 text-indigo-100 dark:bg-indigo-600 text-[13px] tracking-wider shadow-sm">
                                                                    ST
                                                                </div>
                                                            )
                                                        )}
                                                   </div>
                                                   <div className="flex flex-col flex-1 min-w-0">
                                                       <div className="flex items-start justify-between mb-2">
                                                            <div className="flex flex-col min-w-0 pr-2 gap-0.5">
                                                               <span className={`text-[12px] md:text-[13px] font-medium truncate ${isUser ? 'text-neutral-900 dark:text-neutral-100' : 'text-blue-900 dark:text-blue-100'}`}>
                                                                   {isUser ? user?.email : platformSettings.support_email}
                                                               </span>
                                                               <span className="text-[11px] md:text-[12px] text-neutral-500 dark:text-neutral-400 font-mono shrink-0">
                                                                   {format(new Date(msg.created_at), 'MM/dd/yyyy HH:mm')}
                                                               </span>
                                                            </div>
                                                            <button className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1 rounded-md shrink-0"><MoreVertical className="w-5 h-5" /></button>
                                                       </div>
                                                       <div className={`text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap ${isUser ? 'text-neutral-800 dark:text-neutral-200' : 'text-blue-900/90 dark:text-blue-100/90'}`}>
                                                           {msg.message}
                                                       </div>
                                                       {msg.attachment_url && (
                                                           <ResolvedAttachment msg={msg} isUser={isUser} isChat={false} />
                                                       )}
                                                   </div>
                                               </div>
                                           </div>
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
                        <div className="w-full border-t border-neutral-200 dark:border-white/10 p-4 md:p-6 bg-white dark:bg-black shrink-0 relative z-20 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]">
                            <div className="max-w-3xl mx-auto">
                                    {!isReplying ? (
                                        <div className="flex gap-4">
                                             <button onClick={() => setIsReplying(true)} className="flex-1 md:flex-none py-3 px-6 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 dark:text-white shadow-xl bg-white dark:bg-black">
                                                 <Reply className="w-4 h-4" /> Reply
                                             </button>
                                             <button onClick={() => setIsReplying(true)} className="flex-1 md:flex-none py-3 px-6 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm font-medium text-neutral-900 dark:text-white shadow-xl bg-white dark:bg-black">
                                                 <Forward className="w-4 h-4" /> Forward
                                             </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col border border-neutral-300 dark:border-neutral-700 rounded-xl overflow-hidden shadow-2xl bg-white dark:bg-black mt-2">
                                             <div className="px-4 md:px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4 text-neutral-500">
                                               <button type="button" className="hover:text-neutral-900 dark:hover:text-white transition-colors title='Bold'"><Bold className="w-4 h-4" /></button>
                                               <button type="button" className="hover:text-neutral-900 dark:hover:text-white transition-colors title='Italic'"><Italic className="w-4 h-4" /></button>
                                               <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700"></div>
                                               <button type="button" className="hover:text-neutral-900 dark:hover:text-white transition-colors title='Insert List'"><List className="w-4 h-4" /></button>
                                               <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-700"></div>
                                               <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    className="hidden" 
                                                    onChange={handleAttachmentChange} 
                                                />
                                               <button type="button" onClick={() => fileInputRef.current?.click()} className="hover:text-neutral-900 dark:hover:text-white transition-colors title='Attach File'"><Paperclip className="w-4 h-4" /></button>
                                               <button type="button" onClick={() => fileInputRef.current?.click()} className="hover:text-neutral-900 dark:hover:text-white transition-colors title='Insert Image'"><ImageIcon className="w-4 h-4" /></button>
                                               <button type="button" onClick={() => setIsReplying(false)} className="ml-auto hover:text-neutral-900 dark:hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                                            </div>
                                            <div className="p-4 md:px-6 py-4 flex flex-col gap-4">
                                               <textarea 
                                                   className="w-full h-32 bg-transparent outline-none resize-none text-[15px] text-neutral-800 dark:text-neutral-200 placeholder-neutral-500 leading-relaxed custom-scrollbar" 
                                                   placeholder="Write your response... You can drag & drop files here too."
                                                   value={newMessage}
                                                   onChange={(e) => {
                                                       setNewMessage(e.target.value);
                                                       handleUserTyping();
                                                   }}
                                               ></textarea>

                                               {attachment && (
                                                    <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-black rounded-xl border border-neutral-200 dark:border-white/5 w-fit">
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
                                            <div className="px-4 md:px-6 py-3 bg-neutral-50 dark:bg-black border-t border-neutral-200 dark:border-white/10 flex items-center justify-between">
                                               <button type="button" className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-800 dark:text-neutral-200 text-sm font-medium rounded-lg transition-colors">Use Template</button>
                                               <button 
                                                   onClick={e => { handleSendMessage(e); setIsReplying(false); }}
                                                   disabled={sending || (!newMessage.trim() && !attachment)}
                                                   className="px-8 py-2.5 bg-[#4c5add] hover:bg-[#3a45b8] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                               >
                                                   {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                   {sending && isUploadingAttachment ? 'Uploading...' : 'Send Reply'}
                                               </button>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </div>
                    ) : activeConversation ? (
                        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-white/90 dark:bg-black/90 backdrop-blur-md border-t border-neutral-200 dark:border-white/10">
                            <div className="max-w-3xl mx-auto text-center text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                               This ticket has been closed. Please open a new ticket if you need further assistance.
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="flex-1 overflow-hidden relative flex flex-col bg-white dark:bg-black">
                    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto w-full absolute inset-0 pb-24 md:pb-28 px-4 md:px-6 pt-[64px] md:pt-[56px]">
                      {!activeConversation ? (
                         <div className="max-w-xl mx-auto text-center pt-24 space-y-4">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HeadphonesIcon className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Live Support</h2>
                            <p className="text-neutral-500 text-sm max-w-sm mx-auto">Send us a message and we'll connect you to a live agent shortly.</p>
                         </div>
                      ) : (
                        <div className="max-w-3xl mx-auto space-y-6 flex flex-col justify-end min-h-full">
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
                        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-white/90 dark:bg-black/90 backdrop-blur-md border-t border-neutral-200 dark:border-white/10">
                            <div className="max-w-3xl mx-auto text-center text-neutral-500 dark:text-neutral-400 text-sm font-medium">
                               This ticket has been closed. Please open a new ticket if you need further assistance.
                            </div>
                        </div>
                    ) : (
                    <div className="absolute bottom-0 left-0 right-0 px-4 pt-6 pb-3 md:px-6 md:pb-4 bg-gradient-to-t from-white via-white to-transparent dark:from-black dark:via-black">
                      <form onSubmit={handleSendMessage} className={`max-w-3xl mx-auto bg-white dark:bg-black border border-neutral-200 dark:border-neutral-700/60 rounded-[28px] flex flex-col overflow-hidden transition-all focus-within:border-blue-400 dark:focus-within:border-neutral-500 focus-within:ring-4 focus-within:ring-blue-400/10 dark:focus-within:ring-neutral-400/10 mb-2 px-1 py-1`}>
                        
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
              className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 group"
              title={activeTab === 'mail' ? "New Ticket" : "New Chat"}
          >
              <Plus className="w-6 h-6" />
          </button>
      )}

      <ConfirmationModal
          isOpen={!!conversationToDelete}
          onClose={() => setConversationToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={`Delete ${activeTab === 'mail' ? 'Ticket' : 'Chat'}`}
          message={`Are you sure you want to delete this ${activeTab === 'mail' ? 'ticket' : 'chat'}? This action cannot be undone.`}
          confirmButtonText="Delete"
          confirmButtonVariant="danger"
      />
    </div>
  );
};
