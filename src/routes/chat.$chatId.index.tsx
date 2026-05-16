import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Phone, Video, MoreVertical, Smile, Paperclip, BadgeCheck, Bot, Mic, Send, Lock, X, Reply, Camera } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatPeerMenu } from "@/components/ChatPeerMenu";
import { TypingIndicator } from "@/components/TypingIndicator";
import { createTypingBroadcaster, subscribeTyping } from "@/lib/typing";
import { shouldShowOnline } from "@/lib/privacy";
import { Avatar } from "@/components/Avatar";
import { MessageBubble } from "@/components/MessageBubble";
import { CallLogBubble } from "@/components/CallLogBubble";
import { isCallLogMessage, mergeCallLogMessages, reconcileStaleDirectCallLogs, reconcileStaleGroupCallLogs } from "@/lib/call-messages";
import { getActiveGroupCall, type GroupActiveCall } from "@/lib/group-active-calls";
import { canStartGroupCall } from "@/lib/groups";
import { AttachmentSheet } from "@/components/AttachmentSheet";
import { StickerPicker } from "@/components/StickerPicker";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { CameraCapture } from "@/components/CameraCapture";
import { STICKER_TYPE } from "@/lib/stickers";
import { useMe } from "@/lib/use-me";
import { supabase } from "@/integrations/supabase/client";
import { debounce } from "@/lib/debounce";
import { deleteMessage, getProfile, loadMessages, loadReactionsForMessages, sendMessage, toggleReaction } from "@/lib/chats";
import { checkSize, detectKind, getAudioDuration, uploadAttachment } from "@/lib/uploads";
import type { Message, Profile, Reaction } from "@/lib/types";
import { formatDateDivider, shouldShowDateDivider } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUnread } from "@/contexts/unread-context";
import { useCall } from "@/contexts/call-context";
import { useGroupCall } from "@/contexts/group-call-context";
import { privateChatHead } from "@/lib/seo";

export const Route = createFileRoute("/chat/$chatId/")({
  head: () => privateChatHead(),
  component: ChatPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-center mt-20">
      <h2 className="text-lg font-semibold">Couldn't load chat</h2>
      <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
      <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">Back</Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-center mt-20">
      <h2 className="text-lg font-semibold">Chat not found</h2>
      <Link to="/" className="inline-block mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium">Back</Link>
    </div>
  ),
});

function ChatPage() {
  const { chatId } = Route.useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const { markChatRead } = useUnread();
  const { startCall, session: callSession } = useCall();
  const { startGroupCall } = useGroupCall();
  const [other, setOther] = useState<Profile | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [activeGroupCall, setActiveGroupCall] = useState<GroupActiveCall | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesReadyRef = useRef(false);
  const pendingRealtimeRef = useRef<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastReadMsgIdRef = useRef<string | null>(null);
  const reactionsAliveRef = useRef(true);
  const typingBroadcasterRef = useRef<ReturnType<typeof createTypingBroadcaster> | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  // Load chat + other user + live profile updates (avatar, privacy, online)
  useEffect(() => {
    if (!me) return;
    let alive = true;
    const otherIdRef = { current: "" };

    (async () => {
      const { data: chat } = await supabase.from("chats").select("*").eq("id", chatId).maybeSingle();
      if (!chat || !alive) return;
        if (chat.chat_type === "group") {
        setIsGroup(true);
        setGroupTitle(chat.title ?? "Group");
        if (alive) {
          setOther({
            id: chatId,
            username: chat.title ?? "Group",
            avatar_url: (chat as { avatar_url?: string | null }).avatar_url ?? null,
            status: chat.description,
            is_online: false,
            last_seen: new Date().toISOString(),
            created_at: chat.created_at,
          } as Profile);
        }
        return;
      }
      setIsGroup(false);
      otherIdRef.current = chat.user_a === me.id ? chat.user_b : chat.user_a;
      const profile = await getProfile(otherIdRef.current);
      if (alive) setOther(profile);
    })();

    const profileChannel = supabase
      .channel(`profile-${chatId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const p = payload.new as Profile;
          if (!otherIdRef.current || p.id !== otherIdRef.current) return;
          setOther(p);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` },
        (payload) => {
          const chat = payload.new as {
            chat_type?: string;
            title?: string | null;
            description?: string | null;
            avatar_url?: string | null;
          };
          if (chat.chat_type !== "group") return;
          setGroupTitle(chat.title ?? "Group");
          setOther((prev) =>
            prev
              ? {
                  ...prev,
                  username: chat.title ?? "Group",
                  avatar_url: chat.avatar_url ?? null,
                  status: chat.description ?? null,
                }
              : prev
          );
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(profileChannel);
    };
  }, [me, chatId]);

  useEffect(() => {
    if (!me || !isGroup) {
      setActiveGroupCall(null);
      return;
    }
    let alive = true;
    void getActiveGroupCall(chatId).then((row) => {
      if (alive) setActiveGroupCall(row);
    });

    const activeCh = supabase
      .channel(`group-active-call:${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_active_calls", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setActiveGroupCall(null);
            return;
          }
          setActiveGroupCall(payload.new as GroupActiveCall);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(activeCh);
    };
  }, [chatId, me?.id, isGroup]);

  useEffect(() => {
    if (!me || !isGroup || !messagesReadyRef.current) return;
    void reconcileStaleGroupCallLogs(chatId, messages, activeGroupCall, me.id);
  }, [chatId, isGroup, me?.id, activeGroupCall, messages]);

  useEffect(() => {
    if (!me || isGroup || !messagesReadyRef.current) return;
    void reconcileStaleDirectCallLogs(chatId, messages, callSession);
  }, [chatId, isGroup, me?.id, messages, callSession.chatId, callSession.callId, callSession.phase]);

  // Typing indicator channel
  useEffect(() => {
    if (!me) return;
    typingBroadcasterRef.current = createTypingBroadcaster(chatId, me.id, me.username);
    const unsub = subscribeTyping(chatId, me.id, (payload) => {
      setOtherTyping(!!payload?.typing);
    });
    return () => {
      typingBroadcasterRef.current?.destroy();
      typingBroadcasterRef.current = null;
      unsub();
      setOtherTyping(false);
    };
  }, [me, chatId]);

  const scheduleReactionsReload = useMemo(
    () =>
      debounce((ids: string[]) => {
        if (!ids.length) return;
        void loadReactionsForMessages(ids).then((rs) => {
          if (reactionsAliveRef.current) setReactions(rs as Reaction[]);
        });
      }, 350),
    []
  );

  const mergeMessages = useCallback((base: Message[], extras: Message[]) => {
    const byId = new Map<string, Message>();
    for (const m of base) byId.set(m.id, m);
    for (const m of extras) byId.set(m.id, m);
    const merged = [...byId.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return mergeCallLogMessages(merged);
  }, []);

  // Realtime first, then load history — avoids missing messages that arrive during fetch
  useEffect(() => {
    if (!me) return;
    let alive = true;
    messagesReadyRef.current = false;
    pendingRealtimeRef.current = [];

    const appendMessage = (m: Message) => {
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) {
          return mergeCallLogMessages(prev.map((x) => (x.id === m.id ? m : x)));
        }
        return mergeCallLogMessages([...prev, m]);
      });
    };

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const m = payload.new as Message;
          if (!alive) return;
          if (!messagesReadyRef.current) {
            pendingRealtimeRef.current.push(m);
            return;
          }
          appendMessage(m);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          if (!alive) return;
          const m = payload.new as Message;
          setMessages((prev) => mergeCallLogMessages(prev.map((x) => (x.id === m.id ? m : x))));
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
        setMessages((curr) => {
          scheduleReactionsReload(curr.map((m) => m.id));
          return curr;
        });
      })
      .subscribe();

    void (async () => {
      try {
        const msgs = await loadMessages(chatId, me.id);
        if (!alive) return;
        const merged = mergeMessages(msgs, pendingRealtimeRef.current);
        pendingRealtimeRef.current = [];
        setMessages(merged);
        messagesReadyRef.current = true;
        const rs = await loadReactionsForMessages(merged.map((m) => m.id));
        if (alive) setReactions(rs as Reaction[]);
      } catch (e) {
        if (alive) {
          toast.error(e instanceof Error ? e.message : "Access denied");
          navigate({ to: "/" });
        }
      }
    })();

    return () => {
      alive = false;
      scheduleReactionsReload.cancel();
      supabase.removeChannel(channel);
    };
  }, [chatId, me, navigate, mergeMessages, scheduleReactionsReload]);

  useEffect(() => {
    reactionsAliveRef.current = true;
    return () => {
      reactionsAliveRef.current = false;
    };
  }, []);

  // Mark chat read when the latest message changes
  useEffect(() => {
    const latest = messages.at(-1);
    if (!latest || latest.id.startsWith("tmp-")) return;
    if (latest.id === lastReadMsgIdRef.current) return;
    lastReadMsgIdRef.current = latest.id;
    markChatRead(chatId, latest.created_at);
  }, [chatId, messages, markChatRead]);

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
    typingBroadcasterRef.current?.stopTyping();
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

  const handleSendSticker = async (sticker: string) => {
    if (!me || sending) return;
    setStickerOpen(false);
    setReplyTo(null);
    setSending(true);
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      chat_id: chatId,
      sender_id: me.id,
      content: sticker,
      reply_to: null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      attachment_url: null,
      attachment_type: STICKER_TYPE,
      attachment_name: null,
      attachment_size: null,
      attachment_duration: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const real = await sendMessage({
        chat_id: chatId,
        sender_id: me.id,
        content: sticker,
        attachment_type: STICKER_TYPE,
      });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? real : m)));
    } catch (e) {
      console.error(e);
      toast.error("Failed to send sticker");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
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

  const handleCameraCapture = async (file: File, type: "photo" | "video") => {
    if (!me) return;
    const kind = type === "photo" ? "image" : "video";
    const tmpId = `tmp-${Date.now()}`;
    const optimistic: Message = {
      id: tmpId,
      chat_id: chatId,
      sender_id: me.id,
      content: "",
      reply_to: null,
      is_deleted: false,
      created_at: new Date().toISOString(),
      attachment_url: URL.createObjectURL(file),
      attachment_type: file.type,
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
        attachment_type: file.type,
        attachment_name: file.name,
        attachment_size: file.size,
      });
      setMessages((prev) => prev.map((m) => (m.id === tmpId ? real : m)));
    } catch (e) {
      console.error(e);
      toast.error(`Failed to send ${type}`);
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
      await deleteMessage(m.id, me.id);
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
    <motion.div className="absolute inset-0 flex min-w-0 flex-col" style={{ backgroundImage: "var(--gradient-app)" }}>
        {/* Header */}
        <div className="bg-gradient-header backdrop-blur-xl border-b border-border/40">
          <div className="flex items-center justify-between gap-1 px-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pt-[max(2.75rem,calc(0.5rem+env(safe-area-inset-top,0px)))] pb-3 lg:pt-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => navigate({ to: "/" })}
                className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
              >
                <ArrowLeft className="size-5" />
              </button>
              {other && (
                <button
                  type="button"
                  onClick={() => {
                    if (isGroup) navigate({ to: "/chat/$chatId/group", params: { chatId } });
                    else if (other?.id) navigate({ to: "/u/$userId", params: { userId: other.id } });
                  }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-xl hover:bg-muted/30 -mx-1 px-1 transition-colors"
                >
                  <Avatar
                    src={other.avatar_url}
                    name={other.username}
                    size={40}
                    online={!isGroup && shouldShowOnline(other) && other.is_online}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-1">
                      {other.username}
                      {!isGroup && <BadgeCheck className="size-3.5 text-primary" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {isGroup
                        ? "Tap for group info & members"
                        : otherTyping
                          ? "typing…"
                          : shouldShowOnline(other) && other.is_online
                            ? "Online"
                            : "Last seen recently"}
                    </div>
                  </div>
                </button>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button 
                onClick={() => setCameraOpen(true)}
                className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
                aria-label="Open camera"
              >
                <Camera className="size-5" />
              </button>
              {isGroup ? (
                <CallButton
                  icon={Phone}
                  label="Group call"
                  disabled={!me}
                  onClick={() => {
                    if (!me) return;
                    void canStartGroupCall(chatId, me.id).then((ok) => {
                      if (!ok) {
                        toast.error("Only admins can start calls in this group");
                        return;
                      }
                      void startGroupCall(chatId, groupTitle || other.username);
                    });
                  }}
                />
              ) : (
                <>
                  <CallButton
                    icon={Phone}
                    label="Voice call"
                    disabled={!other || !me || callSession.phase !== "idle"}
                    onClick={() =>
                      other &&
                      me &&
                      void startCall(chatId, { id: other.id, username: other.username, avatar_url: other.avatar_url }, false)
                    }
                  />
                  <CallButton
                    icon={Video}
                    label="Video call"
                    disabled={!other || !me || callSession.phase !== "idle"}
                    onClick={() =>
                      other &&
                      me &&
                      void startCall(chatId, { id: other.id, username: other.username, avatar_url: other.avatar_url }, true)
                    }
                  />
                </>
              )}
              {other && me && !isGroup && (
                <ChatPeerMenu
                  meId={me.id}
                  peerId={other.id}
                  peerName={other.username}
                  onBlocked={() => navigate({ to: "/" })}
                  trigger={
                    <button
                      type="button"
                      className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
                      aria-label="Chat options"
                    >
                      <MoreVertical className="size-5" />
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollbar-none py-3 relative">
          <div className="max-w-4xl mx-auto px-3 lg:px-6">
            {/* Encryption notice */}
            <div className="flex justify-center mb-4">
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

            <AnimatePresence>
              {otherTyping && other && <TypingIndicator name={other.username} />}
            </AnimatePresence>

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
                  {isCallLogMessage(m) ? (
                    <CallLogBubble
                      message={m}
                      viewerId={me?.id ?? ""}
                      activeGroupCall={isGroup ? activeGroupCall : null}
                      groupTitle={groupTitle}
                    />
                  ) : (
                    <MessageBubble
                      message={m}
                      isMine={isMine}
                      reactions={reactionsByMsg.get(m.id) ?? []}
                      myId={me?.id ?? ""}
                      showTail={showTail}
                      suppressEntryAnimation
                      replyTo={replied ? { content: replied.content, sender_id: replied.sender_id, isMine: replied.sender_id === me?.id } : null}
                      onReply={setReplyTo}
                      onReact={handleReact}
                      onDelete={handleDelete}
                    />
                  )}
                </div>
              );
            })}
          </div>
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
              <div className="max-w-4xl mx-auto">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Composer — safe-area + min-w-0 avoids clipping the mic FAB on notched Android (e.g. S22). */}
        <div
          className="pt-2 w-full min-w-0 box-border"
          style={{
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="max-w-4xl mx-auto flex items-end gap-2 min-w-0 w-full">
            {recording ? (
              <VoiceRecorder
                onCancel={() => setRecording(false)}
                onSend={handleVoiceSend}
              />
            ) : (
              <div className="flex-1 min-w-0 flex items-end gap-1 bg-card border border-border/60 rounded-3xl pr-2 pl-3 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAttachOpen(false);
                    setStickerOpen((open) => !open);
                  }}
                  className={cn(
                    "size-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                    stickerOpen ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Stickers"
                  aria-expanded={stickerOpen}
                >
                  <Smile className="size-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (e.target.value.trim()) typingBroadcasterRef.current?.signalTyping();
                    else typingBroadcasterRef.current?.stopTyping();
                  }}
                  onKeyDown={handleKey}
                  placeholder="Message..."
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] py-2 max-h-32 placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => {
                    setStickerOpen(false);
                    setAttachOpen(true);
                  }}
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
                type="button"
                onClick={() => {
                  if (text.trim()) handleSend();
                  else setRecording(true);
                }}
                disabled={sending}
                className="shrink-0 size-12 rounded-full bg-gradient-primary shadow-fab flex items-center justify-center text-primary-foreground active:scale-95 transition-transform disabled:opacity-60"
                aria-label={text.trim() ? "Send" : "Record voice"}
              >
                {text.trim() ? <Send className="size-5" /> : <Mic className="size-5" />}
              </button>
            )}
          </div>
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
          onCameraClick={() => setCameraOpen(true)}
        />

        <StickerPicker
          open={stickerOpen}
          onClose={() => setStickerOpen(false)}
          onSelect={handleSendSticker}
        />

        <CameraCapture
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCapture}
        />
    </motion.div>
  );
}

function CallButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Phone;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center disabled:opacity-40"
      aria-label={label}
    >
      <Icon className="size-5" />
    </button>
  );
}
