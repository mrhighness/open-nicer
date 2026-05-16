import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Copy, Check, Camera, ImagePlus, Info, ChevronRight, Heart, Shield, Link2, Share2, KeyRound } from "lucide-react";
import { profileInviteUrl } from "@/lib/share";
import { InviteSocialSheet, requestInviteShare } from "@/components/InviteSocialSheet";
import { copyProfileInvite } from "@/lib/share-invite";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { useMe } from "@/lib/use-me";
import { updateMyProfile } from "@/lib/identity";
import { BIO_MAX } from "@/lib/security/validation";
import { PRODUCT } from "@/lib/product";
import { privacyFromProfile } from "@/lib/privacy";
import { uploadAvatar } from "@/lib/uploads";
import { toast } from "sonner";
import { DesktopNav } from "@/components/DesktopNav";
import { BottomNav } from "@/components/BottomNav";
import { EM_DASH, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/profile")({
  head: () =>
    pageHead({
      title: `Your profile ${EM_DASH} ${PRODUCT.name}`,
      description: `Manage your ${PRODUCT.name} profile, privacy, and invite link.`,
      path: "/profile",
      index: false,
    }),
  component: ProfilePage,
});

function ProfilePage() {
  const { me, setMe } = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [socialShareOpen, setSocialShareOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!me) return;
    setBioDraft(me.bio ?? "");
  }, [me?.id, me?.bio]);

  if (!me) {
    return (
      <ResponsiveLayout>
        <StatusBar />
        <DesktopNav active="profile" />
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      </ResponsiveLayout>
    );
  }

  const privacy = privacyFromProfile(me);

  const startEdit = () => {
    setName(me.username);
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim()) return;
    try {
      const updated = await updateMyProfile(me.id, { username: name.trim() });
      setMe(updated);
      setEditing(false);
      toast.success("Profile updated");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update");
    }
  };

  const saveBio = async () => {
    const normalized = bioDraft.trim() || null;
    if (normalized && normalized.length > BIO_MAX) {
      toast.error(`Bio must be under ${BIO_MAX} characters`);
      return;
    }
    if (normalized === (me.bio ?? null)) return;
    setSavingBio(true);
    try {
      const updated = await updateMyProfile(me.id, { bio: normalized });
      setMe(updated);
      toast.success("Bio saved");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save bio");
    } finally {
      setSavingBio(false);
    }
  };

  const onPhotoPick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(me.id, file, file.name);
      const updated = await updateMyProfile(me.id, { avatar_url: url });
      setMe(updated);
      toast.success("Profile photo updated — others will see it right away");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updatePrivacy = async (patch: Partial<typeof privacy>) => {
    setSavingPrivacy(true);
    try {
      const updated = await updateMyProfile(me.id, patch);
      setMe(updated);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save setting");
    } finally {
      setSavingPrivacy(false);
    }
  };

  const inviteUrl = profileInviteUrl(me.id);

  const copyInviteLink = async () => {
    try {
      await copyProfileInvite(me.id, me.username);
      setCopied(true);
      toast.success("Invite link copied — share it anywhere");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const shareInviteLink = async () => {
    const next = await requestInviteShare(me.id, me.username);
    if (next === "show-picker") setSocialShareOpen(true);
  };

  return (
    <ResponsiveLayout>
      <StatusBar />
      <DesktopNav active="profile" />

      <div className="flex min-w-0 items-center gap-3 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] py-3">
        <Link to="/" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted/60">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 truncate text-lg font-bold">Your profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pb-24 min-w-0 lg:pb-8">
        <div className="mx-auto max-w-2xl min-w-0">
          <div className="flex flex-col items-center pt-4">
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
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative group disabled:opacity-60"
              aria-label="Change profile photo"
            >
              <Avatar src={me.avatar_url} name={me.username} size={120} ring />
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                {uploading ? (
                  <span className="size-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50"
            >
              <ImagePlus className="size-4" />
              {uploading ? "Uploading…" : "Change profile photo"}
            </button>

            {editing ? (
              <div className="mt-5 w-full max-w-xs flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 h-11 px-4 rounded-2xl bg-card border border-border text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void save()}
                  className="size-11 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center"
                >
                  <Check className="size-5" />
                </button>
              </div>
            ) : (
              <div className="mt-5 flex min-w-0 max-w-full items-center gap-2">
                <h2 className="truncate text-2xl font-bold font-display">{me.username}</h2>
                <button
                  type="button"
                  onClick={startEdit}
                  className="size-8 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <Pencil className="size-4 text-muted-foreground" />
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">{me.status}</p>

            <div className="mt-8 w-full max-w-md text-left">
              <label htmlFor="profile-bio" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bio
              </label>
              <textarea
                id="profile-bio"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value.slice(0, BIO_MAX))}
                rows={4}
                placeholder="Tell people about you — shown on your public profile. Paste https://… or www.… links and visitors can tap them."
                className="mt-2 w-full rounded-2xl bg-card border border-border px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y min-h-[100px]"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {bioDraft.length}/{BIO_MAX}
                </span>
                <button
                  type="button"
                  onClick={() => void saveBio()}
                  disabled={savingBio || (bioDraft.trim() || null) === (me.bio ?? null)}
                  className="rounded-xl bg-primary/15 text-primary px-4 py-2 text-xs font-semibold hover:bg-primary/25 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {savingBio ? "Saving…" : "Save bio"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-2 px-1 mb-1">
              <Shield className="size-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Privacy</h3>
            </div>

            <PrivacyToggle
              label="Discoverable"
              description="When off, you won't appear in search or the new-chat list. You can still message anyone."
              checked={privacy.discoverable}
              disabled={savingPrivacy}
              onChange={(discoverable) => void updatePrivacy({ discoverable })}
            />
            <PrivacyToggle
              label="Allow incoming messages"
              description="When off, others can't start new chats with you. Existing chats still work, and you can message others."
              checked={privacy.allow_incoming_messages}
              disabled={savingPrivacy}
              onChange={(allow_incoming_messages) => void updatePrivacy({ allow_incoming_messages })}
            />
            <PrivacyToggle
              label="Show online status"
              description="When off, others won't see when you're online or your activity indicator."
              checked={privacy.show_online_status}
              disabled={savingPrivacy}
              onChange={(show_online_status) => void updatePrivacy({ show_online_status })}
            />

            <div className="bg-card/60 border border-border/60 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Link2 className="size-3.5" />
                Your invite link
              </div>
              <button type="button" onClick={() => void copyInviteLink()} className="mt-2 w-full flex items-center justify-between gap-2 text-left rounded-xl hover:bg-muted/40 px-2 py-2 -mx-2 transition-colors">
                <span className="text-xs text-foreground/90 truncate font-medium">{inviteUrl}</span>
                {copied ? <Check className="size-4 text-online shrink-0" /> : <Copy className="size-4 text-muted-foreground shrink-0" />}
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyInviteLink()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border/60 py-2 text-xs font-semibold hover:bg-muted/40 transition-colors"
                >
                  <Copy className="size-3.5" />
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => void shareInviteLink()}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary/15 text-primary py-2 text-xs font-semibold hover:bg-primary/25 transition-colors"
                >
                  <Share2 className="size-3.5" />
                  Share
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Anyone with this link can connect and message you — even if you&apos;re not discoverable in search.
              </p>
            </div>

            <Link
              to="/retain-account"
              className="bg-card/60 border border-border/60 rounded-2xl p-4 flex items-center gap-3 hover:bg-card/80 transition-colors"
            >
              <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <KeyRound className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-semibold text-sm">Retain account</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Save your 5-digit Account ID and Nicer PIN, or sign in to an account you saved before.
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </Link>

            <Link
              to="/about"
              className="bg-card/60 border border-border/60 rounded-2xl p-4 flex items-center gap-3 hover:bg-card/80 transition-colors"
            >
              <div className="size-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center">
                <Info className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">About Open Nicer</div>
                <p className="text-xs text-muted-foreground truncate">Open source from Nicle Inc. · Product spec</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>

            <div className="bg-card/60 border border-border/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                <Heart className="size-3.5 text-primary shrink-0 mt-0.5" />
                <span>{PRODUCT.footerAttribution}</span>
              </div>
              <a
                href={PRODUCT.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-95 active:scale-[0.98] transition-all"
              >
                <Heart className="size-4" fill="currentColor" />
                Support this project
              </a>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="profile" />

      <InviteSocialSheet
        open={socialShareOpen}
        onClose={() => setSocialShareOpen(false)}
        userId={me.id}
        username={me.username}
      />
    </ResponsiveLayout>
  );
}
