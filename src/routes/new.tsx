import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, Users } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/use-me";
import { listAllOtherProfiles } from "@/lib/chats";
import { getOrCreateChatWith } from "@/lib/identity";
import type { Profile } from "@/lib/types";
import { shouldShowOnline } from "@/lib/privacy";
import { toast } from "sonner";

import { EM_DASH, pageHead } from "@/lib/seo";
import { PRODUCT } from "@/lib/product";

export const Route = createFileRoute("/new")({
  head: () =>
    pageHead({
      title: `New chat ${EM_DASH} ${PRODUCT.name}`,
      description: `Start a new conversation on ${PRODUCT.name}.`,
      path: "/new",
      index: false,
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
      toast.error(e instanceof Error ? e.message : "Could not open chat");
      setOpening(null);
    }
  };

  const filtered = (profiles ?? []).filter((p) =>
    !search || p.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ResponsiveLayout>
      <StatusBar />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] py-3">
          <Link to="/" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted/60">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">New chat</h1>
            <p className="text-xs text-muted-foreground">Pick someone to message</p>
          </div>
        </div>

        <div className="shrink-0 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-3">
          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-lg">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="h-11 w-full rounded-2xl border border-border/60 bg-card/60 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto w-full max-w-4xl min-w-0">
          {profiles === null ? (
            <div className="px-6 py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto size-16 rounded-3xl bg-gradient-primary/20 flex items-center justify-center mb-3">
                <Users className="size-7 text-primary" />
              </div>
              <h3 className="font-semibold">No one here yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[260px] mx-auto">
                Open Nicer in another browser or device to create a second user, then come back to start chatting.
              </p>
            </div>
          ) : (
            <ul className="px-2 lg:px-4 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2">
              {filtered.map((p) => (
                <li key={p.id} className="lg:col-span-1">
                  <button
                    onClick={() => handleOpen(p)}
                    disabled={opening === p.id}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-card/40 transition-colors text-left disabled:opacity-60 lg:border lg:border-border/40 lg:bg-card/20 lg:hover:bg-card/60"
                  >
                    <Avatar src={p.avatar_url} name={p.username} size={48} online={shouldShowOnline(p) && p.is_online} />
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
      </div>
    </div>
    </ResponsiveLayout>
  );
}
