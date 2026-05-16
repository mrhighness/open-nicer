import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Crown,
  ImagePlus,
  Shield,
  Trash2,
  Users,
  Phone,
} from "lucide-react";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/use-me";
import {
  getGroupById,
  getGroupMembersWithRoles,
  getMyGroupRole,
  isGroupAdmin,
  removeGroupMember,
  updateGroup,
  type GroupChatRow,
  type GroupMember,
  type GroupMemberRole,
} from "@/lib/groups";
import { assertChatMember } from "@/lib/chats";
import { uploadGroupAvatar } from "@/lib/uploads";
import { supabase } from "@/integrations/supabase/client";
import { formatDateDivider } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EM_DASH, pageHead } from "@/lib/seo";
import { PRODUCT } from "@/lib/product";

export const Route = createFileRoute("/chat/$chatId/group")({
  head: ({ params }) =>
    pageHead({
      title: `Group info ${EM_DASH} ${PRODUCT.name}`,
      description: "Group profile and members.",
      path: `/chat/${params.chatId}/group`,
      index: false,
    }),
  component: GroupProfilePage,
});

function roleLabel(role: GroupMemberRole) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function GroupProfilePage() {
  const { chatId } = Route.useParams();
  const navigate = useNavigate();
  const { me } = useMe();
  const fileRef = useRef<HTMLInputElement>(null);

  const [group, setGroup] = useState<GroupChatRow | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myRole, setMyRole] = useState<GroupMemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const admin = isGroupAdmin(myRole);

  const reload = async () => {
    if (!me) return;
    await assertChatMember(chatId, me.id);
    const [g, list, role] = await Promise.all([
      getGroupById(chatId),
      getGroupMembersWithRoles(chatId),
      getMyGroupRole(chatId, me.id),
    ]);
    if (!g) {
      toast.error("Group not found");
      navigate({ to: "/" });
      return;
    }
    setGroup(g);
    setMembers(list);
    setMyRole(role);
  };

  useEffect(() => {
    if (!me) return;
    let alive = true;
    setLoading(true);
    void reload()
      .catch((e) => {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Could not load group");
        navigate({ to: "/" });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const channel = supabase
      .channel(`group-profile:${chatId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats", filter: `id=eq.${chatId}` },
        (payload) => {
          const row = payload.new as GroupChatRow;
          if (row.chat_type === "group") setGroup(row);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members", filter: `chat_id=eq.${chatId}` },
        () => {
          void getGroupMembersWithRoles(chatId).then(setMembers);
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [chatId, me?.id]);

  const onPhotoPick = async (file: File) => {
    if (!me || !group || !admin) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadGroupAvatar(chatId, file, file.name);
      await updateGroup(chatId, me.id, { avatar_url: url });
      setGroup((g) => (g ? { ...g, avatar_url: url } : g));
      toast.success("Group photo updated for everyone");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not update photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async (member: GroupMember) => {
    if (!me || !admin) return;
    const ok = window.confirm(`Remove ${member.username} from this group?`);
    if (!ok) return;
    setRemovingId(member.id);
    try {
      await removeGroupMember(chatId, me.id, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success(`${member.username} was removed`);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not remove member");
    } finally {
      setRemovingId(null);
    }
  };

  if (!me || loading || !group) {
    return (
      <div className="flex flex-1 flex-col min-h-0">
        <StatusBar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 w-full bg-background">
      <StatusBar />
      <div className="flex flex-col min-h-0 flex-1 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 px-4 pt-12 pb-4 border-b border-border/40">
          <button
            type="button"
            onClick={() => navigate({ to: "/chat/$chatId", params: { chatId } })}
            className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-lg font-semibold font-display">Group info</h1>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none pb-8">
          <div className="flex flex-col items-center px-6 pt-8 pb-6">
            <div className="relative">
              <Avatar src={group.avatar_url} name={group.title ?? "Group"} size={112} />
              {admin && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onPhotoPick(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-0 right-0 size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background disabled:opacity-60"
                    aria-label="Change group photo"
                  >
                    {uploading ? (
                      <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                  </button>
                </>
              )}
            </div>
            <h2 className="mt-4 text-2xl font-bold font-display text-center">{group.title ?? "Group"}</h2>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <Users className="size-4" />
              {members.length} member{members.length === 1 ? "" : "s"}
            </p>
          </div>

          <section className="px-4 space-y-4">
            {group.description ? (
              <div className="rounded-2xl bg-card/60 border border-border/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-sm whitespace-pre-wrap">{group.description}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card/40 border border-border/30 p-4 text-sm text-muted-foreground">
                No description
              </div>
            )}

            <div className="rounded-2xl bg-card/60 border border-border/40 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Created</p>
              <p className="text-sm">{formatDateDivider(group.created_at)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(group.created_at).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>

            {admin && (
              <p className="text-xs text-muted-foreground px-1 flex items-center gap-1.5">
                <Shield className="size-3.5 text-primary" />
                You are a group admin — you can change the photo and remove members.
              </p>
            )}

            <div className="rounded-2xl bg-card/60 border border-border/40 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Phone className="size-3.5" />
                Group calls
              </p>
              <label
                className={cn(
                  "flex items-center justify-between gap-3",
                  !admin && "opacity-60"
                )}
              >
                <span className="text-sm">
                  All members can start calls
                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                    When off, only owners and admins can start group calls.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={group.group_members_can_start_calls !== false}
                  disabled={!admin}
                  onChange={(e) => {
                    if (!me || !admin) return;
                    void updateGroup(chatId, me.id, {
                      group_members_can_start_calls: e.target.checked,
                    })
                      .then(() => {
                        setGroup((g) =>
                          g ? { ...g, group_members_can_start_calls: e.target.checked } : g
                        );
                        toast.success("Call settings updated");
                      })
                      .catch((err) => {
                        console.error(err);
                        toast.error("Could not update settings");
                      });
                  }}
                />
              </label>
            </div>

          </section>

          <section className="mt-6 px-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Members</h3>
            <ul className="space-y-1">
              {members.map((member) => {
                const canRemove =
                  admin &&
                  member.id !== me.id &&
                  member.role !== "owner" &&
                  (myRole === "owner" || member.role === "member");
                return (
                  <li key={member.id} className="flex items-center gap-0 rounded-2xl border border-transparent hover:border-border/30 hover:bg-card/50">
                    <Link
                      to="/u/$userId"
                      params={{ userId: member.id }}
                      className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5 rounded-2xl"
                    >
                      <Avatar src={member.avatar_url} name={member.username} size={44} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {member.username}
                          {member.id === me.id && (
                            <span className="text-muted-foreground font-normal"> (you)</span>
                          )}
                        </p>
                        <p
                          className={cn(
                            "text-xs flex items-center gap-1",
                            member.role === "owner" || member.role === "admin"
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          {member.role === "owner" && <Crown className="size-3" />}
                          {member.role === "admin" && <Shield className="size-3" />}
                          {roleLabel(member.role)}
                        </p>
                      </div>
                    </Link>
                    {canRemove && (
                      <button
                        type="button"
                        disabled={removingId === member.id}
                        onClick={() => void handleRemove(member)}
                        className="size-9 rounded-full hover:bg-destructive/15 text-destructive flex items-center justify-center disabled:opacity-50"
                        aria-label={`Remove ${member.username}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {admin && (
            <div className="px-4 mt-6">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-border/50 bg-card/40 text-sm font-medium hover:bg-card/70 disabled:opacity-50"
              >
                <ImagePlus className="size-4 text-primary" />
                {uploading ? "Uploading…" : "Change group photo"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
