# Support System Database Schema & Admin Instructions

Yeh manual Admin Panel Developer ke liye hai taake woh apney database mein Inbox system setup kar sakein. Ismein Tables, RLS policies, aur Realtime listen karne ki instructions details ke sath hain.

### 1. Database Schema

Niche diye gaye SQL queries run kar ke tables create kijiye. Ek table support threads (conversations) ke liye hai aur doosra messages ke liye. "type" field define karta hai k ticket "chat" mode mein hai ya "mail" mode.

```sql
-- 1. Create support_conversations table
CREATE TABLE public.support_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('chat', 'mail')),
    subject TEXT, -- mail mode ke liye use hoga, chat ke liye null
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    guest_email TEXT
);

-- 2. Create support_messages table
CREATE TABLE public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.support_conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_type VARCHAR(20) CHECK (sender_type IN ('user', 'admin')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE NULL,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger Function for updated_at
CREATE OR REPLACE FUNCTION update_support_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.support_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_support_conversation_updated_at
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION update_support_conversation_updated_at();

-- Turn on Row Level Security
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for support_conversations
-- Users can see their own
CREATE POLICY "Users can view their own support conversations"
    ON public.support_conversations FOR SELECT
    USING (auth.uid() = user_id);

-- Enabling guests to insert
CREATE POLICY "Guests can create their own support conversations"
    ON public.support_conversations FOR INSERT
    TO public, anon, authenticated
    WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL AND guest_email IS NOT NULL));

-- Users can delete their own
CREATE POLICY "Users can delete their own support conversations"
    ON public.support_conversations FOR DELETE
    USING (auth.uid() = user_id);

-- For admin panel, assuming admins have a specific role or access list.
-- For now, if Admin panel bypassed via service role key, RLS is automatically bypassed.
-- But if using user token, create a policy allowing admins (e.g., using an admin_users table) to select/update.

-- 4. RLS Policies for support_messages
-- Users can see messages in their own conversations
CREATE POLICY "Users can view messages in their conversations"
    ON public.support_messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        )
    );

-- Users and guests can insert messages in their conversations
CREATE POLICY "Users can insert messages in their conversations"
    ON public.support_messages FOR INSERT
    TO public, anon, authenticated
    WITH CHECK (
        sender_type = 'user' AND (
            (sender_id = auth.uid() AND conversation_id IN (SELECT id FROM public.support_conversations WHERE user_id = auth.uid()))
            OR 
            (sender_id IS NULL AND conversation_id IS NOT NULL)
        )
    );

-- Users can delete their own messages (required for cascading deletes or manual removal)
CREATE POLICY "Users can delete messages in their conversations"
    ON public.support_messages FOR DELETE
    USING (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        )
    );

-- Users can update messages (to mark admin messages as read)
CREATE POLICY "Users can update messages setting is_read"
    ON public.support_messages FOR UPDATE
    USING (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        ) AND sender_type = 'admin'
    )
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.support_conversations WHERE user_id = auth.uid()
        ) AND sender_type = 'admin' AND is_read = true
    );

-- Enable Realtime
-- Admin aur User done bina delay k messages and tickets details haasil karein
ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
```

### 2. Admin Panel Developer ke liye Frontend/Listening Instructions

Admin Panel (Web ya App jahan Inbox dikhega) mein real-time receive/response ke liye ye supabase subscription pattern use karein: No delay system on `INSERT` aur `UPDATE`.

```javascript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("SUPABASE_URL", "SUPABASE_ANON_KEY");
// or use service_role key for admin APIs if executing backend side

// 1. Listen for new Conversations (Mails or Chats)
const conversationSubscription = supabase
  .channel("admin-support-conversations")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "support_conversations" },
    (payload) => {
      console.log("New Ticket/Chat Received!", payload.new);
      // UI update karein - Naya Inbox row
    },
  )
  .subscribe();

// 2. Listen for new Messages
const messageSubscription = supabase
  .channel("admin-support-messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "support_messages" },
    (payload) => {
      console.log(
        "New Reply Received for Conversation",
        payload.new.conversation_id,
      );
      if (payload.new.sender_type === "user") {
        // Play notification sound
        // Add message to chat window if opened
      }
    },
  )
  .subscribe();

// 3. Admin Reply Kaise Karega
async function replyToUser(
  conversationId,
  adminUserId,
  text,
  attachmentUrl = null,
  attachmentName = null,
  attachmentType = null,
) {
  const { data, error } = await supabase.from("support_messages").insert({
    conversation_id: conversationId,
    sender_id: adminUserId,
    sender_type: "admin",
    message: text,
    attachment_url: attachmentUrl,
    attachment_name: attachmentName,
    attachment_type: attachmentType,
  });
  // Supabase trigger k zariye user ko front end me real-time push pohoch jayega!
}

// 4. Mark Messages as Read (Read Receipts / Double Blue Ticks)
// Jab admin kisi conversation ko open kare, unread messages ko read mark karne ke liye:
async function markUserMessagesAsRead(conversationId) {
  const { error } = await supabase
    .from("support_messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_type", "user")
    .eq("is_read", false);
}
```

### 3. Attachments & Telegram Storage (Admin Instructions)

1. **Attachment Fields**: `support_messages` me `attachment_url`, `attachment_name`, aur `attachment_type` columns add kiye gaye hain. Admin dashboard pe inhe check karein.
2. **Telegram Hosted URLs**: `attachment_url` ek raw public file URL hoga (ya Telegram Storage bridge URL jo node wrapper se banega). Agar woh URL image hai (`attachment_type.startsWith('image/')`), to sidha `<img src={attachment_url} />` render karwayein. Normal files k aage Download button dein jiska `href` wae `attachment_url` ho.
3. **Fetching logic**: Yeh URLs publicly accessible honge, yani authentication ki zaroorat nahi hai (Telegram bot APIs ke direct URLs nahi hone chahiye, bulke ek proxy endpoint / public URL hona chahiye jo frontend provide karta hai). Just render it as a standard <a> or <img> tag.

Apne Inbox ko categorize karein "Chats" aur "Mails" filter laga ke, kyunki `support_conversations.type` bata dega k user direct live chat kar raha hai ya form submit kiya hai email k jese.
