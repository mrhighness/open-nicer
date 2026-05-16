import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleDot, Plus, ArrowLeft, Eye, Loader2 } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { DesktopNav } from "@/components/DesktopNav";
import { BottomNav } from "@/components/BottomNav";
import { StatusViewerRoot } from "@/components/StatusViewer";
import { useMe } from "@/lib/use-me";
import { formatStatusTime } from "@/lib/format";
import {
  createStatusUpdate,
  getMyStatusGroup,
  getOthersStatusGroups,
  listStatusGroups,
  type StatusGroup,
} from "@/lib/status";
import { uploadStatusImage } from "@/lib/uploads";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { EM_DASH, pageHead } from "@/lib/seo";
import { PRODUCT } from "@/lib/product";

export const Route = createFileRoute("/status")({
  head: () =>
    pageHead({
      title: `Status ${EM_DASH} ${PRODUCT.name}`,
      description: `Share image status updates on ${PRODUCT.name}.`,
      path: "/status",
      index: false,
    }),
  component: StatusPage,
});

type ViewerState = {
  groups: StatusGroup[];
  groupIndex: number;
  itemIndex: number;
  viewerId: string;
  onClose: () => void;
  onChange: (groupIndex: number, itemIndex: number) => void;
};

function StatusPage() {
  const { me, loading: meLoading } = useMe();
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!me) return;
    try {
      const list = await listStatusGroups(me.id);
      setGroups(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    setLoading(true);
    listStatusGroups(me.id)
      .then((list) => {
        if (alive) setGroups(list);
      })
      .catch(console.error)
      .finally(() => {
        if (alive) setLoading(false);
      });

    const channel = supabase
      .channel("status-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "status_updates" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "status_views" }, () => reload())
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [me, reload]);

  const myGroup = me ? getMyStatusGroup(groups, me.id) : null;
  const others = me ? getOthersStatusGroups(groups, me.id) : [];
  const recent = others.filter((g) => !g.viewed);
  const viewed = others.filter((g) => g.viewed);

  const openViewer = (targetGroups: StatusGroup[], groupIndex: number, itemIndex = 0) => {
    if (!me) return;
    setViewer({
      groups: targetGroups,
      groupIndex,
      itemIndex,
      viewerId: me.id,
      onClose: () => setViewer(null),
      onChange: (gi, ii) =>
        setViewer((v) => (v ? { ...v, groupIndex: gi, itemIndex: ii } : null)),
    });
  };

  const openOthersViewer = (group: StatusGroup) => {
    const idx = others.findIndex((g) => g.user.id === group.user.id);
    if (idx >= 0) openViewer(others, idx);
  };

  const pickImage = () => fileRef.current?.click();

  const onFile = async (file: File) => {
    if (!me) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are supported for status right now");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadStatusImage(me.id, file, file.name);
      await createStatusUpdate(me.id, url);
      await reload();
      toast.success("Status posted — visible for 24 hours");
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Couldn't post status";
      toast.error(
        msg.includes("status_updates") || msg.includes("schema")
          ? "Status isn't set up yet. Run the latest database migration on Supabase."
          : msg
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onMyStatusClick = () => {
    if (myGroup && myGroup.items.length > 0) {
      openViewer([myGroup], 0);
    } else {
      pickImage();
    }
  };

  if (meLoading || !me) {
    return (
      <ResponsiveLayout>
        <StatusBar />
        <DesktopNav active="status" />
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <StatusBar />
      <DesktopNav active="status" />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      <div className="lg:hidden flex min-w-0 items-center justify-between gap-2 px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="lg:hidden size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight font-display">Status</h1>
            <p className="text-xs text-muted-foreground lg:hidden">Share a photo — disappears in 24h</p>
          </div>
        </div>
      </div>

      <div className="px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-3">
        <div
          role="button"
          tabIndex={0}
          onClick={onMyStatusClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onMyStatusClick();
            }
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-card/40 active:bg-card/60 transition-colors text-left cursor-pointer",
            uploading && "opacity-60 pointer-events-none"
          )}
        >
          <div className="relative">
            {myGroup && myGroup.items.length > 0 ? (
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-glow to-primary p-[2px]">
                <div className="size-full rounded-full bg-background" />
              </div>
            ) : null}
            <Avatar src={me.avatar_url} name={me.username} size={52} ring={false} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pickImage();
              }}
              disabled={uploading}
              className="absolute bottom-0 right-0 size-6 rounded-full bg-gradient-primary flex items-center justify-center border-2 border-background"
              aria-label="Add status photo"
            >
              {uploading ? (
                <Loader2 className="size-3.5 text-primary-foreground animate-spin" />
              ) : (
                <Plus className="size-4 text-primary-foreground" />
              )}
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">My Status</h3>
            <p className="text-xs text-muted-foreground">
              {uploading
                ? "Uploading…"
                : myGroup && myGroup.items.length > 0
                  ? `${myGroup.items.length} update${myGroup.items.length === 1 ? "" : "s"} · ${formatStatusTime(myGroup.latestAt)}`
                  : "Tap to add a photo status"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none pb-24 lg:pb-4">
        <div className="w-full min-w-0 px-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] lg:px-6 xl:px-10">
          {loading ? (
            <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading statuses…</div>
          ) : (
            <>
              {recent.length > 0 && (
                <div className="mb-6">
                  <div className="px-5 py-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Recent updates
                    </h2>
                  </div>
                  <ul className="space-y-1">
                    {recent.map((group) => (
                      <StatusRow key={group.user.id} group={group} onOpen={() => openOthersViewer(group)} />
                    ))}
                  </ul>
                </div>
              )}

              {viewed.length > 0 && (
                <div>
                  <div className="px-5 py-2">
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Viewed updates
                    </h2>
                  </div>
                  <ul className="space-y-1">
                    {viewed.map((group) => (
                      <StatusRow key={group.user.id} group={group} onOpen={() => openOthersViewer(group)} />
                    ))}
                  </ul>
                </div>
              )}

              {!loading && others.length === 0 && !myGroup && <EmptyState />}
            </>
          )}
        </div>
      </div>

      <BottomNav active="status" />
      {viewer ? <StatusViewerRoot {...viewer} /> : null}
    </ResponsiveLayout>
  );
}

function StatusRow({ group, onOpen }: { group: StatusGroup; onOpen: () => void }) {
  const hasMultiple = group.items.length > 1;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-card/40 active:bg-card/60 transition-colors text-left lg:border lg:border-border/40 lg:bg-card/20 lg:hover:bg-card/60"
      >
        <div className="relative">
          <div
            className={cn(
              "absolute inset-0 rounded-full p-[2px]",
              group.viewed ? "bg-muted" : "bg-gradient-to-br from-primary-glow to-primary"
            )}
          >
            <div className="size-full rounded-full bg-background" />
          </div>
          <Avatar src={group.user.avatar_url} name={group.user.username} size={52} ring={false} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{group.user.username}</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {group.viewed && <Eye className="size-3 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">
              {formatStatusTime(group.latestAt)}
              {hasMultiple ? ` · ${group.items.length} updates` : ""}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto size-20 rounded-3xl bg-gradient-primary/20 flex items-center justify-center mb-4">
        <CircleDot className="size-9 text-primary" />
      </div>
      <h3 className="font-semibold text-lg">No status updates yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-[280px] mx-auto">
        Post a photo from My Status above. Others&apos; updates will show here when they share.
      </p>
    </div>
  );
}
