import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  Trash2,
  Users,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  rpcAdminDeleteGroups,
  rpcAdminDeleteProfiles,
  rpcAdminListGroups,
  rpcAdminListUsers,
  rpcAdminSetSuspended,
  rpcAdminStats,
  rpcAdminUpdateProfile,
  rpcIsAppAdmin,
  type AdminGroupRow,
  type AdminStats,
  type AdminUserRow,
} from "@/lib/admin-api";
import { PRODUCT } from "@/lib/product";
import { EM_DASH, pageHead } from "@/lib/seo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export const Route = createFileRoute("/hc")({
  head: () =>
    pageHead({
      title: `Admin ${EM_DASH} ${PRODUCT.name}`,
      description: "Internal administration",
      path: "/hc",
      index: false,
    }),
  component: AdminPanelPage,
});

function AdminPanelPage() {
  const [sessionReady, setSessionReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [tab, setTab] = useState<"users" | "groups">("users");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(() => new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(() => new Set());
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editBio, setEditBio] = useState("");

  type AdminConfirm =
    | null
    | { kind: "bulk_delete_users"; ids: string[] }
    | { kind: "bulk_delete_groups"; ids: string[] }
    | { kind: "toggle_suspend"; user: AdminUserRow; suspend: boolean };

  const [confirmSheet, setConfirmSheet] = useState<AdminConfirm>(null);

  const refreshAll = useCallback(async () => {
    const [s, u, g] = await Promise.all([rpcAdminStats(), rpcAdminListUsers(), rpcAdminListGroups()]);
    setStats(s);
    setUsers(u);
    setGroups(g);
  }, []);

  const verifySession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setIsAdmin(false);
      setSessionReady(true);
      return;
    }
    const ok = await rpcIsAppAdmin();
    setIsAdmin(ok);
    setSessionReady(true);
    if (ok) void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void verifySession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void verifySession();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [verifySession]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      const ok = await rpcIsAppAdmin();
      if (!ok) {
        await supabase.auth.signOut();
        toast.error("This account is not authorized for admin access.");
        return;
      }
      setPassword("");
      toast.success("Signed in");
      await refreshAll();
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setStats(null);
    setUsers([]);
    setGroups([]);
    setSelectedUsers(new Set());
    setSelectedGroups(new Set());
    toast.success("Signed out");
  };

  const allUserIds = useMemo(() => users.map((u) => u.id), [users]);
  const allGroupIds = useMemo(() => groups.map((g) => g.id), [groups]);

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAllUsers = (checked: boolean) => {
    setSelectedUsers(checked ? new Set(allUserIds) : new Set());
  };

  const selectAllGroups = (checked: boolean) => {
    setSelectedGroups(checked ? new Set(allGroupIds) : new Set());
  };

  const executeConfirm = async () => {
    if (!confirmSheet) return;
    setBusy(true);
    try {
      if (confirmSheet.kind === "bulk_delete_users") {
        const n = await rpcAdminDeleteProfiles(confirmSheet.ids);
        toast.success(`Deleted ${n} profile(s)`);
        setSelectedUsers(new Set());
        await refreshAll();
      } else if (confirmSheet.kind === "bulk_delete_groups") {
        const n = await rpcAdminDeleteGroups(confirmSheet.ids);
        toast.success(`Deleted ${n} group(s)`);
        setSelectedGroups(new Set());
        await refreshAll();
      } else if (confirmSheet.kind === "toggle_suspend") {
        const ok = await rpcAdminSetSuspended(confirmSheet.user.id, confirmSheet.suspend);
        if (ok) {
          toast.success(confirmSheet.suspend ? "Suspended" : "Unsuspended");
          await refreshAll();
        } else toast.error("Failed");
      }
    } finally {
      setBusy(false);
      setConfirmSheet(null);
    }
  };

  const openEdit = (u: AdminUserRow) => {
    setEditUser(u);
    setEditName(u.username);
    setEditAvatar(u.avatar_url ?? "");
    setEditBio(u.bio ?? "");
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setBusy(true);
    try {
      const ok = await rpcAdminUpdateProfile(editUser.id, {
        username: editName.trim(),
        avatar_url: editAvatar.trim(),
        bio: editBio.trim(),
      });
      if (ok) {
        toast.success("Profile updated");
        setEditUser(null);
        await refreshAll();
      } else toast.error("Update failed");
    } finally {
      setBusy(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="size-8 animate-spin opacity-70" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-b from-slate-950 to-slate-900 text-white">
        <Shield className="size-12 text-violet-400 mb-4" />
        <h1 className="text-2xl font-bold font-display">Admin sign-in</h1>
        <p className="mt-2 text-sm text-white/60 text-center max-w-sm">
          Sign in with an email that is listed in <code className="text-white/80">app_admins</code> (see SQL migration). Create the Auth user in the Supabase Dashboard first.
        </p>
        <form onSubmit={(e) => void onLogin(e)} className="mt-8 w-full max-w-sm space-y-4">
          <div>
            <Label className="text-white/80">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <Label className="text-white/80">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 bg-white/10 border-white/20 text-white"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <Link to="/" className="mt-8 text-sm text-violet-300 hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="size-4" /> Back to app
        </Link>
      </div>
    );
  }

  const allUsersSelected = allUserIds.length > 0 && selectedUsers.size === allUserIds.length;
  const allGroupsSelected = allGroupIds.length > 0 && selectedGroups.size === allGroupIds.length;

  return (
    <div className="min-h-dvh bg-slate-950 text-white pb-16">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="size-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/15 shrink-0">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Admin</p>
            <h1 className="text-lg font-bold font-display truncate">{PRODUCT.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white hover:bg-white/10"
            disabled={busy}
            onClick={() => void refreshAll()}
          >
            <RefreshCw className={cn("size-4", busy && "animate-spin")} />
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void onLogout()}>
            <LogOut className="size-4 mr-1" /> Log out
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6">
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {[
              { label: "Users", value: stats.user_count },
              { label: "Groups", value: stats.group_count },
              { label: "Suspended", value: stats.suspended_count },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex flex-col"
              >
                <span className="text-xs text-white/50 uppercase tracking-wide">{c.label}</span>
                <span className="text-3xl font-bold font-display mt-1">{c.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant={tab === "users" ? "default" : "outline"}
            size="sm"
            className={tab !== "users" ? "border-white/20 bg-transparent text-white" : ""}
            onClick={() => setTab("users")}
          >
            <Users className="size-4 mr-1" /> Users
          </Button>
          <Button
            type="button"
            variant={tab === "groups" ? "default" : "outline"}
            size="sm"
            className={tab !== "groups" ? "border-white/20 bg-transparent text-white" : ""}
            onClick={() => setTab("groups")}
          >
            Groups
          </Button>
        </div>

        {tab === "users" && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allUsersSelected}
                  onCheckedChange={(v) => selectAllUsers(Boolean(v))}
                  aria-label="Select all users"
                />
                <span className="text-xs text-white/60">Select all</span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!selectedUsers.size || busy}
                onClick={() => {
                  if (!selectedUsers.size) return;
                  setConfirmSheet({ kind: "bulk_delete_users", ids: [...selectedUsers] });
                }}
              >
                <Trash2 className="size-3.5 mr-1" /> Delete selected ({selectedUsers.size})
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-slate-900/95 text-white/60 text-xs uppercase">
                  <tr>
                    <th className="p-2 w-10" />
                    <th className="p-2">User</th>
                    <th className="p-2">Email</th>
                    <th className="p-2">Joined</th>
                    <th className="p-2">Device</th>
                    <th className="p-2">Location</th>
                    <th className="p-2">Invites</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-2">
                        <Checkbox
                          checked={selectedUsers.has(u.id)}
                          onCheckedChange={() => toggleUser(u.id)}
                          aria-label={`Select ${u.username}`}
                        />
                      </td>
                      <td className="p-2 font-medium">{u.username}</td>
                      <td className="p-2 text-white/70 text-xs max-w-[140px] truncate">{u.email ?? "—"}</td>
                      <td className="p-2 text-xs text-white/60 whitespace-nowrap">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="p-2 text-xs text-white/50 max-w-[160px] truncate" title={u.user_agent ?? ""}>
                        {u.user_agent ? u.user_agent.slice(0, 48) + (u.user_agent.length > 48 ? "…" : "") : "—"}
                      </td>
                      <td className="p-2 text-xs text-white/60">{u.country || u.ip || "—"}</td>
                      <td className="p-2 text-center">{u.invite_count}</td>
                      <td className="p-2">
                        {u.suspended_at ? (
                          <span className="text-amber-400 text-xs font-semibold">Suspended</span>
                        ) : (
                          <span className="text-emerald-400/90 text-xs">Active</span>
                        )}
                      </td>
                      <td className="p-2 flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => openEdit(u)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-white/20"
                          onClick={() => {
                            const suspend = !u.suspended_at;
                            setConfirmSheet({ kind: "toggle_suspend", user: u, suspend });
                          }}
                        >
                          <Ban className="size-3 mr-0.5" />
                          {u.suspended_at ? "Unban" : "Ban"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "groups" && (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allGroupsSelected}
                  onCheckedChange={(v) => selectAllGroups(Boolean(v))}
                  aria-label="Select all groups"
                />
                <span className="text-xs text-white/60">Select all</span>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!selectedGroups.size || busy}
                onClick={() => {
                  if (!selectedGroups.size) return;
                  setConfirmSheet({ kind: "bulk_delete_groups", ids: [...selectedGroups] });
                }}
              >
                <Trash2 className="size-3.5 mr-1" /> Delete selected ({selectedGroups.size})
              </Button>
            </div>
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0 bg-slate-900/95 text-white/60 text-xs uppercase">
                  <tr>
                    <th className="p-2 w-10" />
                    <th className="p-2">Title</th>
                    <th className="p-2">Members</th>
                    <th className="p-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-2">
                        <Checkbox
                          checked={selectedGroups.has(g.id)}
                          onCheckedChange={() => toggleGroup(g.id)}
                          aria-label={`Select group`}
                        />
                      </td>
                      <td className="p-2 font-medium">{g.title ?? "Untitled group"}</td>
                      <td className="p-2">{g.member_count}</td>
                      <td className="p-2 text-xs text-white/60">{new Date(g.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Username</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 bg-white/5 border-white/20" />
            </div>
            <div>
              <Label>Avatar URL</Label>
              <Input value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} className="mt-1 bg-white/5 border-white/20" />
            </div>
            <div>
              <Label>Bio</Label>
              <Input value={editBio} onChange={(e) => setEditBio(e.target.value)} className="mt-1 bg-white/5 border-white/20" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer
        dismissible={!busy}
        open={confirmSheet !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmSheet(null);
        }}
      >
        <DrawerContent className="border-t border-white/10 bg-slate-900 text-white max-h-[90dvh] rounded-t-3xl px-2 pb-[max(1rem,env(safe-area-inset-bottom))] [&>div:first-child]:bg-white/25">
          <DrawerHeader className="text-center pb-0">
            <DrawerTitle className="text-base font-semibold">
              {confirmSheet?.kind === "bulk_delete_users" && "Delete profiles?"}
              {confirmSheet?.kind === "bulk_delete_groups" && "Delete groups?"}
              {confirmSheet?.kind === "toggle_suspend" &&
                (confirmSheet.suspend ? `Suspend ${confirmSheet.user.username}?` : `Unsuspend ${confirmSheet.user.username}?`)}
            </DrawerTitle>
            <DrawerDescription className="text-white/60 text-sm pt-1">
              {confirmSheet?.kind === "bulk_delete_users" &&
                `This will permanently remove ${confirmSheet.ids.length} user profile(s) and related data. This cannot be undone.`}
              {confirmSheet?.kind === "bulk_delete_groups" &&
                `This will delete ${confirmSheet.ids.length} group(s) and all messages inside them.`}
              {confirmSheet?.kind === "toggle_suspend" &&
                (confirmSheet.suspend
                  ? "They will not be able to use the app until unsuspended."
                  : "They will be able to sign in and use the app again.")}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-col gap-2 pt-4 sm:flex-col">
            <Button
              type="button"
              variant={
                confirmSheet?.kind === "toggle_suspend" && !confirmSheet.suspend ? "default" : "destructive"
              }
              className={cn(
                "w-full h-12 rounded-2xl text-base font-semibold",
                confirmSheet?.kind === "toggle_suspend" && !confirmSheet.suspend && "bg-emerald-600 hover:bg-emerald-600/90"
              )}
              disabled={busy}
              onClick={() => void executeConfirm()}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : confirmSheet?.kind === "bulk_delete_users" ? (
                "Delete profiles"
              ) : confirmSheet?.kind === "bulk_delete_groups" ? (
                "Delete groups"
              ) : confirmSheet?.kind === "toggle_suspend" ? (
                confirmSheet.suspend ? (
                  "Suspend"
                ) : (
                  "Unsuspend"
                )
              ) : null}
            </Button>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-2xl border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                disabled={busy}
              >
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
