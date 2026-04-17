import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, Video, MoreVertical, Smile, Paperclip, BadgeCheck, Bot, Mic, Send, Lock, X, Reply } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MobileFrame } from "@/components/MobileFrame";
import { Avatar } from "@/components/Avatar";
import { MessageBubble } from "@/components/MessageBubble";
import { AttachmentSheet } from "@/components/AttachmentSheet";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useMe } from "@/lib/use-me";
import { supabase } from "@/integrations/supabase/client";
import { deleteMessage, getProfile, loadMessages, loadReactionsForMessages, sendMessage, toggleReaction } from "@/lib/chats";
import { checkSize, detectKind, getAudioDuration, uploadAttachment } from "@/lib/uploads";
import type { Message, Profile, Reaction } from "@/lib/types";
import { formatDateDivider, shouldShowDateDivider } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$chatId")({
  head: ({ params }) => ({
    meta: [
      { title: `Chat — Nicer` },
      { name: "description", content: `Conversation ${params.chatId} on Nicer.` },
    ],
  }),
  component: ChatPage,
  errorComponent: ({ error }) => (
    <MobileFrame>
      <div className="p-6 text-center mt-20">
        <h2 className="text-lg font-semibold">Couldn't load chat</h2>
        <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
        <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">Back</Link>
      </div>
    </MobileFrame>
  ),
  notFoundComponent: () => (
    <MobileFrame>
      <div className="p-6 text-center mt-20">
        <h2 className="text-lg font-semibold">Chat not found</h2>
        <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">Back</Link>
      </div>
    </MobileFrame>
  ),
});

function ChatPage() {
  const { chatId } = Route.useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat + other user
  useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (!chat || !alive) return;
      const otherId = chat.user_a === me.id ? chat.user_b : chat.user_a;
      const profile = await getProfile(otherId);
      if (alive) setOther(profile);
    })();
    return () => { alive = false; };
  }, [me, chatId]);

  // Load messages + reactions
  useEffect(() => {
    let alive = true;
    (async () => {
      const msgs = await loadMessages(chatId);
      if (!alive) return;
      setMessages(msgs);
      const rs = await loadReactionsForMessages(msgs.map((m) => m.id));
      if (alive) setReactions(rs as Reaction[]);
    })();
    return () => { alive = false; };
  }, [chatId]);

  // Realtime subscription for messages + reactions in this chat
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, async () => {
        // Reload reactions for current messages
        setMessages((curr) => {
          loadReactionsForMessages(curr.map((m) => m.id)).then((rs) => setReactions(rs as Reaction[]));
          return curr;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  const messagesById = useMemo(() => {
    const m = new Map<string, Message>();
    messages.forEach((x) => m.set(x.id, x));
    return m;
  }, [messages]);

  const reactionsByMsg = useMemo(() => {
    const m = new Map<string, Reaction[]>();
    reactions.forEach((r) => {
      if (!m.has(r.message_id)) m.set(r.message_id, []);
      m.get(r.message_id)!.push(r);
    });
    return m;
  }, [reactions]);

  const handleSend = async () => {
    if (!me || !text.trim() || sending) return;
    const content = text.trim();
    setText("");
    const replySnapshot = replyTo;
    setReplyTo(null);
    setSending(true);
    // Optimistic
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      chat_id: chatId,
      sender_id: me.id,
      content,
      reply_to: replySnapshot?.id ?? null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      attachment_url: null,
      attachment_type: null,
      attachment_name: null,
      attachment_size: null,
      attachment_duration: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const real = await sendMessage({ chat_id: chatId, sender_id: me.id, content, reply_to: replySnapshot?.id ?? null });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
    } catch (e) {
      console.error(e);
      toast.error("Failed to send");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!me) return;
    for (const file of Array.from(files)) {
      const kind = detectKind(file);
      const sizeError = checkSize(file, kind);
      if (sizeError) {
        toast.error(`${file.name}: ${sizeError}`);
        continue;
      }
      const tmpId = `tmp-${Date.now()}-${Math.random()}`;
      const optimistic: Message = {
        id: tmpId,
        chat_id: chatId,
        sender_id: me.id,
        content: "",
        reply_to: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        attachment_url: URL.createObjectURL(file),
        attachment_type: file.type || "application/octet-stream",
        attachment_name: file.name,
        attachment_size: file.size,
        attachment_duration: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      setUploadingCount((c) => c + 1);
      try {
        const { url } = await uploadAttachment(file, {
          chatId,
          senderId: me.id,
          filename: file.name,
          kind,
        });
        const real = await sendMessage({
          chat_id: chatId,
          sender_id: me.id,
          content: "",
          attachment_url: url,
          attachment_type: file.type || "application/octet-stream",
          attachment_name: file.name,
          attachment_size: file.size,
        });
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? real : m)));
      } catch (e) {
        console.error(e);
        toast.error(`Failed to send ${file.name}`);
        setMessages((prev) => prev.filter((m) => m.id !== tmpId));
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  };

  const handleVoiceSend = async (blob: Blob, durationSec: number) => {
    if (!me) return;
    setRecording(false);
    const finalDur = durationSec || (await getAudioDuration(blob));
    const tmpId = `tmp-${Date.now()}`;
    const filename = `voice-${Date.now()}.webm`;
    const optimistic: Message = {
      id: tmpId,
      chat_id: chatId,
      sender_id: me.id,
      content: "",
      reply_to: null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      attachment_url: URL.createObjectURL(blob),
      attachment_type: blob.type || "audio/webm",
      attachment_name: filename,
      attachment_size: blob.size,
      attachment_duration: finalDur,
    };
    setMessages((prev) => [...prev, optimistic]);
    setUploadingCount((c) => c + 1);
    try {
      const { url } = await uploadAttachment(blob, { chatId, senderId: me.id, filename, kind: "audio" });
      const real = await sendMessage({
        chat_id: chatId,
        sender_id: me.id,
        content: "",
        attachment_url: url,
        attachment_type: blob.type || "audio/webm",
        attachment_name: filename,
        attachment_size: blob.size,
        attachment_duration: finalDur,
      });
      setMessages((prev) => prev.map((m) => (m.id === tmpId ? real : m)));
    } catch (e) {
      console.error(e);
      toast.error("Failed to send voice note");
      setMessages((prev) => prev.filter((m) => m.id !== tmpId));
    } finally {
      setUploadingCount((c) => c - 1);
    }
  };

  const handleReact = async (m: Message, emoji: string) => {
    if (!me) return;
    try {
      await toggleReaction(m.id, me.id, emoji);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't react");
    }
  };

  const handleDelete = async (m: Message) => {
    if (!me || m.sender_id !== me.id) return;
    try {
      await deleteMessage(m.id);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't delete");
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <MobileFrame>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="absolute inset-0 flex flex-col"
        style={{ backgroundImage: "var(--gradient-app)" }}
      >
        {/* Header */}
        <div className="bg-gradient-header backdrop-blur-xl border-b border-border/40">
          <div className="flex items-center justify-between px-3 pt-12 pb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => navigate({ to: "/" })}
                className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
              >
                <ArrowLeft className="size-5" />
              </button>
              {other && (
                <Link to="/" className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Avatar src={other.avatar_url} name={other.username} size={40} online={other.is_online} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-1">
                      {other.username} <BadgeCheck className="size-3.5 text-primary" />
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {other.is_online ? "Online" : "Last seen recently"}
                    </div>
                  </div>
                </Link>
              )}
            </div>
            <div className="flex items-center gap-1">
              <CallButton icon={Phone} label="Voice call" />
              <CallButton icon={Video} label="Video call" />
              <button className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center">
                <MoreVertical className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollbar-none py-3 relative">
          {/* Encryption notice */}
          <div className="flex justify-center mb-4 px-6">
            <div className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-[11px] text-center text-foreground/80 max-w-[280px] flex items-start gap-2">
              <Lock className="size-3.5 text-primary mt-0.5 shrink-0" />
              <span>Messages and calls are end-to-end encrypted. Tap to learn more.</span>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-10">
              No messages yet. Say hi 👋
            </div>
          )}

          {messages.map((m, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const next = i < messages.length - 1 ? messages[i + 1] : null;
            const showDate = shouldShowDateDivider(m.created_at, prev?.created_at ?? null);
            const isMine = m.sender_id === me?.id;
            const showTail = !next || next.sender_id !== m.sender_id;
            const replied = m.reply_to ? messagesById.get(m.reply_to) : null;
            return (
              <div key={m.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-full bg-card/60 backdrop-blur text-[11px] text-muted-foreground font-medium">
                      {formatDateDivider(m.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  isMine={isMine}
                  reactions={reactionsByMsg.get(m.id) ?? []}
                  myId={me?.id ?? ""}
                  showTail={showTail}
                  replyTo={replied ? { content: replied.content, sender_id: replied.sender_id, isMine: replied.sender_id === me?.id } : null}
                  onReply={setReplyTo}
                  onReact={handleReact}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}
        </div>

        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="px-3 pt-2"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border-l-2 border-primary">
                <Reply className="size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-primary">
                    Replying to {replyTo.sender_id === me?.id ? "yourself" : other?.username ?? "them"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{replyTo.content}</div>
                </div>
                <button onClick={() => setReplyTo(null)} className="size-7 rounded-full hover:bg-muted flex items-center justify-center">
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer */}
        <div className="px-3 pt-2 pb-4 flex items-end gap-2">
          {recording ? (
            <VoiceRecorder
              onCancel={() => setRecording(false)}
              onSend={handleVoiceSend}
            />
          ) : (
            <div className="flex-1 flex items-end gap-1 bg-card border border-border/60 rounded-3xl pr-2 pl-3 py-1.5">
              <button className="size-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
                <Smile className="size-5" />
              </button>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message..."
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] py-2 max-h-32 placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setAttachOpen(true)}
                className="size-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Attach file"
              >
                <Paperclip className="size-5" />
              </button>
              <button className="size-9 rounded-full flex items-center justify-center text-primary shrink-0" aria-label="AI assistant">
                <Bot className="size-5" />
              </button>
            </div>
          )}
          {!recording && (
            <button
              onClick={() => {
                if (text.trim()) handleSend();
                else setRecording(true);
              }}
              disabled={sending}
              className="size-12 rounded-full bg-gradient-primary shadow-fab flex items-center justify-center text-primary-foreground active:scale-95 transition-transform disabled:opacity-60"
              aria-label={text.trim() ? "Send" : "Record voice"}
            >
              {text.trim() ? <Send className="size-5" /> : <Mic className="size-5" />}
            </button>
          )}
        </div>

        {uploadingCount > 0 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur border border-border rounded-full px-3 py-1 text-xs text-muted-foreground shadow-lg z-30">
            Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}…
          </div>
        )}

        <AttachmentSheet
          open={attachOpen}
          onClose={() => setAttachOpen(false)}
          onPick={(files) => handleFiles(files)}
        />
      </motion.div>
    </MobileFrame>
  );
}

function CallButton({ icon: Icon, label }: { icon: typeof Phone; label: string }) {
  return (
    <button
      onClick={() => toast.info(`${label} coming soon`)}
      className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
      aria-label={label}
    >
      <Icon className="size-5" />
    </button>
  );
}
