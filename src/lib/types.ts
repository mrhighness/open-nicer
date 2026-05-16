import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Chat = Tables<"chats"> & {
  chat_type?: string | null;
  title?: string | null;
  description?: string | null;
  created_by?: string | null;
  invite_code?: string | null;
  avatar_url?: string | null;
};
export type Message = Tables<"messages">;
export type Reaction = Tables<"reactions">;
export type StatusUpdate = Tables<"status_updates">;
export type StatusView = Tables<"status_views">;

export type ChatWithMeta = Chat & {
  other: Profile;
  lastMessage: Message | null;
  unreadCount: number;
  isGroup?: boolean;
  memberCount?: number;
};

export type MessageWithExtras = Message & {
  reactions: Reaction[];
  replyToMessage: Pick<Message, "id" | "content" | "sender_id"> | null;
};

export function isGroupChat(chat: Pick<Chat, "chat_type">) {
  return chat.chat_type === "group";
}
