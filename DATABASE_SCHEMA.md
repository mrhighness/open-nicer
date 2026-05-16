# Open Nicer - Database Schema & TypeScript Types

## 📊 Database Tables

### 1. **profiles** - User Profiles
Anonymous users without authentication.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `username` | TEXT | - | User's display name |
| `avatar_url` | TEXT | `null` | URL to user's avatar image |
| `status` | TEXT | `'Hey there! I am using Open Nicer.'` | User's status message |
| `is_online` | BOOLEAN | `true` | Online status |
| `last_seen` | TIMESTAMPTZ | `now()` | Last activity timestamp |
| `created_at` | TIMESTAMPTZ | `now()` | Account creation timestamp |

**Indexes:**
- Primary key on `id`

---

### 2. **chats** - One-to-One Conversations
Represents a conversation between two users.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_a` | UUID | - | First user (must be < user_b) |
| `user_b` | UUID | - | Second user (must be > user_a) |
| `created_at` | TIMESTAMPTZ | `now()` | Chat creation timestamp |

**Constraints:**
- `user_a < user_b` (ensures consistent ordering)
- `UNIQUE(user_a, user_b)` (prevents duplicate chats)

**Foreign Keys:**
- `user_a` → `profiles(id)` ON DELETE CASCADE
- `user_b` → `profiles(id)` ON DELETE CASCADE

**Indexes:**
- Primary key on `id`
- Index on `user_a`
- Index on `user_b`

---

### 3. **messages** - Chat Messages
Messages sent within chats, with support for attachments and replies.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `chat_id` | UUID | - | Reference to chat |
| `sender_id` | UUID | - | Reference to sender profile |
| `content` | TEXT | `''` | Message text content |
| `reply_to` | UUID | `null` | Reference to replied message |
| `is_deleted` | BOOLEAN | `false` | Soft delete flag |
| `attachment_url` | TEXT | `null` | URL to attachment file |
| `attachment_type` | TEXT | `null` | MIME type of attachment |
| `attachment_name` | TEXT | `null` | Original filename |
| `attachment_size` | BIGINT | `null` | File size in bytes |
| `attachment_duration` | NUMERIC | `null` | Duration for audio/video (seconds) |
| `created_at` | TIMESTAMPTZ | `now()` | Message timestamp |

**Foreign Keys:**
- `chat_id` → `chats(id)` ON DELETE CASCADE
- `sender_id` → `profiles(id)` ON DELETE CASCADE
- `reply_to` → `messages(id)` ON DELETE SET NULL

**Indexes:**
- Primary key on `id`
- Composite index on `(chat_id, created_at)`

---

### 4. **reactions** - Message Reactions
Emoji reactions to messages.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `message_id` | UUID | - | Reference to message |
| `user_id` | UUID | - | Reference to user who reacted |
| `emoji` | TEXT | - | Emoji character(s) |
| `created_at` | TIMESTAMPTZ | `now()` | Reaction timestamp |

**Constraints:**
- `UNIQUE(message_id, user_id, emoji)` (one emoji per user per message)

**Foreign Keys:**
- `message_id` → `messages(id)` ON DELETE CASCADE
- `user_id` → `profiles(id)` ON DELETE CASCADE

**Indexes:**
- Primary key on `id`
- Index on `message_id`

---

## 🗄️ Storage Buckets

### **attachments** - Public File Storage
Stores message attachments (images, videos, audio, documents).

**Policies:**
- Anyone can read
- Anyone can upload
- Anyone can update
- Anyone can delete

---

## 🔐 Row Level Security (RLS)

All tables have RLS enabled with **permissive policies** (no authentication required):

- ✅ Anyone can SELECT (read)
- ✅ Anyone can INSERT (create)
- ✅ Anyone can UPDATE (modify)
- ✅ Anyone can DELETE (remove)

---

## 📡 Realtime

All tables have **REPLICA IDENTITY FULL** and are added to the `supabase_realtime` publication:
- `profiles` - Live online status updates
- `chats` - New chat notifications
- `messages` - Real-time message delivery
- `reactions` - Live reaction updates

---

## 📝 TypeScript Types

### Base Types (Auto-generated from Database)

```typescript
// src/integrations/supabase/types.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          avatar_url: string | null
          status: string | null
          is_online: boolean
          last_seen: string
          created_at: string
        }
        Insert: {
          id?: string
          username: string
          avatar_url?: string | null
          status?: string | null
          is_online?: boolean
          last_seen?: string
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          avatar_url?: string | null
          status?: string | null
          is_online?: boolean
          last_seen?: string
          created_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          user_a: string
          user_b: string
          created_at: string
        }
        Insert: {
          id?: string
          user_a: string
          user_b: string
          created_at?: string
        }
        Update: {
          id?: string
          user_a?: string
          user_b?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          content: string
          reply_to: string | null
          is_deleted: boolean
          attachment_url: string | null
          attachment_type: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_duration: number | null
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          content?: string
          reply_to?: string | null
          is_deleted?: boolean
          attachment_url?: string | null
          attachment_type?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_duration?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          content?: string
          reply_to?: string | null
          is_deleted?: boolean
          attachment_url?: string | null
          attachment_type?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_duration?: number | null
          created_at?: string
        }
      }
      reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
    }
  }
}
```

### Application Types (Helper Types)

```typescript
// src/lib/types.ts

import type { Tables } from "@/integrations/supabase/types";

// Base table types
export type Profile = Tables<"profiles">;
export type Chat = Tables<"chats">;
export type Message = Tables<"messages">;
export type Reaction = Tables<"reactions">;

// Extended types with relationships
export type ChatWithMeta = Chat & {
  other: Profile;              // The other user in the chat
  lastMessage: Message | null;  // Most recent message
  unreadCount: number;          // Number of unread messages
};

export type MessageWithExtras = Message & {
  reactions: Reaction[];        // All reactions to this message
  replyToMessage: Pick<Message, "id" | "content" | "sender_id"> | null;
};
```

---

## 🔄 Type Usage Examples

### Creating a new profile
```typescript
import type { TablesInsert } from "@/integrations/supabase/types";

const newProfile: TablesInsert<"profiles"> = {
  username: "John Doe",
  avatar_url: "https://example.com/avatar.jpg",
  status: "Hello World!"
};
```

### Updating a message
```typescript
import type { TablesUpdate } from "@/integrations/supabase/types";

const messageUpdate: TablesUpdate<"messages"> = {
  content: "Updated message text",
  is_deleted: false
};
```

### Working with chat metadata
```typescript
import type { ChatWithMeta } from "@/lib/types";

const chat: ChatWithMeta = {
  id: "...",
  user_a: "...",
  user_b: "...",
  created_at: "...",
  other: {
    id: "...",
    username: "Jane",
    avatar_url: "...",
    // ... other profile fields
  },
  lastMessage: {
    id: "...",
    content: "Hey there!",
    // ... other message fields
  },
  unreadCount: 3
};
```

---

## 📋 Summary

✅ **4 Tables**: profiles, chats, messages, reactions  
✅ **1 Storage Bucket**: attachments  
✅ **Full TypeScript Support**: Auto-generated + helper types  
✅ **Realtime Enabled**: All tables support live updates  
✅ **RLS Configured**: Permissive policies for demo app  
✅ **Proper Indexing**: Optimized for common queries  
✅ **Foreign Keys**: Referential integrity maintained  
✅ **Soft Deletes**: Messages can be marked as deleted  
✅ **Attachments**: Full support for media files  
✅ **Reactions**: Emoji reactions on messages  
✅ **Replies**: Thread-like message replies  

---

**Built by Mr. Highness Chinedu, CEO of All Things Web Technology Inc.**
