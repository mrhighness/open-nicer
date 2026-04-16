import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/use-me";
import { listAllOtherProfiles } from "@/lib/chats";
import { getOrCreateChatWith } from "@/lib/identity";
import type { Profile } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New chat — Nicer" },
      { name: "description", content: "Start a new conversation on Nicer." },
    ],
  }),
  component: NewChatPage,
});

function NewChatPage() {
  const { me } = useMe();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [search, setSearch] = useState("");
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    listAllOtherProfiles(me.id).then(setProfiles).catch(console.error);
  }, [me]);

  const handleOpen = async (other: Profile) => {
    if (!me || opening) return;
    setOpening(other.id);
    try {
      const chat = await getOrCreateChatWith(me.id, other.id);
      navigate({ to: "/chat/$chatId", params: { chatId: chat.id } });
    } catch (e) {
      console.error(e);
      toast.error("Could not open chat");
      setOpening(null);
    }
  };

  const filtered = (profiles ?? []).filter((p) =>
    !search || p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MobileFrame>
      <StatusBar />

      <div className="flex items-center gap-3 px-4 py-3">
        <Link to="/" className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">New chat</h1>
          <p className="text-xs text-muted-foreground">Pick someone to message</p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people"
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-card/60 border border-border/60 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none pb-6">
        {profiles === null ? (
          <div className="px-6 py-10 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto size-16 rounded-3xl bg-gradient-primary/20 flex items-center justify-center mb-3">
              <Sparkles className="size-7 text-primary" />
            </div>
            <h3 className="font-semibold">No one here yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[260px] mx-auto">
              Open Nicer in another browser or device to create a second user, then come back to start chatting.
            </p>
          </div>
        ) : (
          <ul className="px-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => handleOpen(p)}
                  disabled={opening === p.id}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-card/40 transition-colors text-left disabled:opacity-60"
                >
                  <Avatar src={p.avatar_url} name={p.username} size={48} online={p.is_online} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.status ?? "Available"}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileFrame>
  );
}
