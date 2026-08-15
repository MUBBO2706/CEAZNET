import { supabase } from './supabaseClient';
import { SupportConversation, SupportMessage } from '../types';

export const supportService = {
  async getConversations(userId: string): Promise<(SupportConversation & { unread_count?: number, last_message?: string, last_message_time?: string })[]> {
    const { data: convData, error } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching support conversations:', error);
      throw error;
    }
    const conversations = convData || [];
    
    if (conversations.length === 0) return [];
    
    const ids = conversations.map(c => c.id);
    const { data: msgsData, error: msgsError } = await supabase
      .from('support_messages')
      .select('*')
      .in('conversation_id', ids);
      
    if (msgsError) {
      console.error('Error fetching support messages for details:', msgsError);
      return conversations;
    }
    
    return conversations.map(c => {
        const msgs = (msgsData || []).filter(m => m.conversation_id === c.id);
        msgs.sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const unreadCount = msgs.filter(m => m.sender_type === 'admin' && !m.is_read).length;
        const lastMsg = msgs[msgs.length - 1];
        
        let lastMsgStr = '';
        if (lastMsg) {
            lastMsgStr = lastMsg.sender_type === 'user' ? 'You: ' : '';
            lastMsgStr += lastMsg.message ? lastMsg.message : (lastMsg.attachment_name ? '📎 ' + lastMsg.attachment_name : 'Sent an attachment');
        }

        return {
            ...c,
            unread_count: unreadCount,
            last_message: lastMsgStr,
            last_message_time: lastMsg ? lastMsg.created_at : undefined
        };
    });
  },

  async getMessages(conversationId: string): Promise<SupportMessage[]> {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching support messages:', error);
      throw error;
    }
    return data || [];
  },

  async createConversation(userId: string, type: 'chat' | 'mail', subject?: string): Promise<SupportConversation> {
    const { data, error } = await supabase
      .from('support_conversations')
      .insert({
        user_id: userId,
        type,
        subject,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating support conversation:', error);
      throw error;
    }
    return data;
  },

  async createGuestConversation(type: 'chat' | 'mail', subject: string, guestEmail: string): Promise<SupportConversation> {
    const id = window.crypto.randomUUID();
    const { error } = await supabase
      .from('support_conversations')
      .insert({
        id,
        user_id: null,
        type,
        subject,
        guest_email: guestEmail,
        status: 'open'
      });

    if (error) {
      console.error('Error creating guest support conversation:', error);
      throw error;
    }
    return { id, type, subject, guest_email: guestEmail, status: 'open' } as unknown as SupportConversation;
  },

  async sendGuestMessage(conversationId: string, message: string): Promise<SupportMessage> {
    const id = window.crypto.randomUUID();
    const { error } = await supabase
      .from('support_messages')
      .insert({
        id,
        conversation_id: conversationId,
        sender_id: null,
        sender_type: 'user',
        message
      });

    if (error) {
      console.error('Error sending guest support message:', error);
      throw error;
    }
    return { id, conversation_id: conversationId, sender_id: null, sender_type: 'user', message } as unknown as SupportMessage;
  },

  async sendMessage(conversationId: string, userId: string, message: string, attachment?: { url: string, name: string, type: string }): Promise<SupportMessage> {
    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        sender_type: 'user',
        message,
        ...(attachment ? {
          attachment_url: attachment.url,
          attachment_name: attachment.name,
          attachment_type: attachment.type
        } : {})
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending support message:', error);
      throw error;
    }

    // Update conversation's updated_at
    await supabase
      .from('support_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  },

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('support_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'admin') // user marks admin messages as read
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
    }
  },

  async deleteConversation(conversationId: string): Promise<void> {
    // Delete messages first to avoid foreign key constraints
    await supabase
      .from('support_messages')
      .delete()
      .eq('conversation_id', conversationId);

    const { error, count } = await supabase
      .from('support_conversations')
      .delete({ count: 'exact' })
      .eq('id', conversationId);

    if (error) {
      console.error('Error deleting support conversation:', error);
      throw error;
    }
    
    if (count === 0) {
      throw new Error('Deletion blocked by database permissions. Need to enable DELETE in RLS policy.');
    }
  },

  async updateMessage(messageId: string, newMessage: string): Promise<SupportMessage> {
    const { data, error } = await supabase
      .from('support_messages')
      .update({ message: newMessage })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating support message:', error);
      throw error;
    }
    return data;
  },

  async deleteMessage(messageId: string): Promise<void> {
    const { error } = await supabase
      .from('support_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting support message:', error);
      throw error;
    }
  },

  subscribeToMessages(conversationId: string, callback: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE', new: SupportMessage, old?: any }) => void) {
    const subscription = supabase
      .channel(`support_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          callback(payload as any);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  subscribeToConversations(userId: string, callback: (conversation: SupportConversation) => void) {
      const subscription = supabase
          .channel(`support_conversations_${userId}`)
          .on(
              'postgres_changes',
              {
                  event: '*', // Listen to INSERT, UPDATE
                  schema: 'public',
                  table: 'support_conversations',
                  filter: `user_id=eq.${userId}`
              },
              (payload) => {
                  if (payload.new && Object.keys(payload.new).length > 0) {
                      callback(payload.new as SupportConversation);
                  }
              }
          )
          .subscribe();

      return () => {
          supabase.removeChannel(subscription);
      }
  }
};
