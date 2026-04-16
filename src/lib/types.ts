import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Chat = Tables<"chats">;
export type Message = Tables<"messages">;
export type Reaction = Tables<"reactions">;

export type ChatWithMeta = Chat & {
  other: Profile;
  lastMessage: Message | null;
  unreadCount: number;
};

export type MessageWithExtras = Message & {
  reactions: Reaction[];
  replyToMessage: Pick<Message, "id" | "content" | "sender_id"> | null;
};
