import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MessageCircle, MoreVertical, Share2 } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { Avatar } from "@/components/Avatar";
import { BioWithLinks } from "@/components/BioWithLinks";
import { ChatPeerMenu } from "@/components/ChatPeerMenu";
import { getProfileForInvite } from "@/lib/invite";
import { getExistingDirectChatId, getOrCreateChatWith } from "@/lib/identity";
import { useMe } from "@/lib/use-me";
import {
  getSiteOrigin,
  inviteOgDescription,
  inviteOgImage,
  isValidProfileId,
  profileInviteUrl,
} from "@/lib/share";
import { copyProfileInvite, shareProfileInvite } from "@/lib/share-invite";
import { setProfileReferrer } from "@/lib/referrer";
import { PRODUCT } from "@/lib/product";
import { profileInviteHead } from "@/lib/seo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/u/$userId")({
  loader: async ({ params }) => {
    if (!isValidProfileId(params.userId)) throw notFound();

    const profile = await getProfileForInvite(params.userId);
    if (!profile) throw notFound();

    const origin = getSiteOrigin();
    return { profile, origin, userId: params.userId };
  },
  head: ({ loaderData }) => {
    if (!loaderData?.profile) {
      return {
        meta: [{ title: "Profile not found — Open Nicer" }],
      };
    }
    const { profile: p, origin } = loaderData;
    const url = profileInviteUrl(p.id, origin);
    const image = inviteOgImage(p.avatar_url, origin);
    const description = inviteOgDescription(p.username, p.status, p.bio);

    return profileInviteHead({
      username: p.username,
      description,
      url,
      image,
      userId: p.id,
      origin,
    });
  },
  component: PublicProfilePage,
  notFoundComponent: InviteNotFound,
});

function InviteNotFound() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">
      <AppLogo className="h-10 mb-8 opacity-80" />
      <h1 className="text-xl font-bold font-display">Profile not found</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
        This link may be invalid or the profile is unavailable.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Open {PRODUCT.name}
      </Link>
    </div>
  );
}

function PublicProfilePage() {
  const { profile, userId: routeUserId } = Route.useLoaderData();
  const { me, loading: meLoading } = useMe();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [existingChatId, setExistingChatId] = useState<string | null>(null);

  const profileMatchesRoute = profile.id === routeUserId;
  const isSelf = Boolean(me && profileMatchesRoute && me.id === routeUserId);
  const canConnect = profile.allow_incoming_messages !== false;
  const defaultStatus = profile.status?.trim() === PRODUCT.inviteShareText;
  const showStatus = Boolean(profile.status?.trim()) && !defaultStatus;

  useEffect(() => {
    if (!isSelf && profile.id) setProfileReferrer(profile.id);
  }, [isSelf, profile.id]);

  useEffect(() => {
    if (!me || isSelf) {
      setExistingChatId(null);
      return;
    }
    let cancelled = false;
    void getExistingDirectChatId(me.id, profile.id).then((id) => {
      if (!cancelled) setExistingChatId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [me?.id, profile.id, isSelf]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  };

  const goToChat = (chatId: string) => {
    navigate({ to: "/chat/$chatId", params: { chatId } });
  };

  const onMessage = async () => {
    if (!me || connecting || isSelf) return;
    if (existingChatId) {
      goToChat(existingChatId);
      return;
    }
    if (!canConnect) {
      toast.error(`${profile.username} isn't accepting new messages right now`);
      return;
    }
    setConnecting(true);
    try {
      const chat = await getOrCreateChatWith(me.id, profile.id);
      goToChat(chat.id);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't open chat");
      setConnecting(false);
    }
  };

  const onShareProfile = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const r = await shareProfileInvite({ userId: profile.id, username: profile.username });
      if (r === "shared") toast.success("Shared");
      else if (r === "cancelled") {
        /* noop */
      } else {
        await copyProfileInvite(profile.id, profile.username);
        toast.success("Profile link copied");
      }
    } catch (e) {
      console.error(e);
      try {
        await copyProfileInvite(profile.id, profile.username);
        toast.success("Profile link copied");
      } catch {
        toast.error("Couldn't copy link");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="h-full w-full object-cover opacity-35 blur-3xl scale-110"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/60 to-black/88" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-sm transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-[11px] font-bold tracking-[0.22em] text-white/90 uppercase">Profile</span>
        {!isSelf && me ? (
          <ChatPeerMenu
            meId={me.id}
            peerId={profile.id}
            peerName={profile.username}
            onBlocked={() => void navigate({ to: "/" })}
            trigger={
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-sm transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="size-5" />
              </button>
            }
          />
        ) : (
          <span className="size-10 inline-block shrink-0" aria-hidden />
        )}
      </header>

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <Avatar
          src={profile.avatar_url}
          name={profile.username}
          size={120}
          className="shadow-2xl"
        />

        <h1 className="mt-7 text-center text-3xl font-bold font-display tracking-tight text-white drop-shadow-sm">
          {profile.username}
        </h1>

        {profile.bio ? (
          <BioWithLinks
            text={profile.bio}
            className="mt-4 max-w-md text-center text-[15px] leading-relaxed text-white/85"
            linkClassName="text-sky-300 hover:text-sky-200"
          />
        ) : null}

        {showStatus ? (
          <p
            className={cn(
              "mt-3 max-w-md text-center text-sm text-white/65",
              profile.bio ? "" : "mt-4"
            )}
          >
            {profile.status}
          </p>
        ) : null}

        {isSelf ? (
          <div className="mt-10 w-full max-w-md space-y-4">
            <p className="text-center text-sm text-white/70 leading-relaxed">
              This is your public profile link. Share it so anyone can open your profile and message you.
            </p>
            <Link
              to="/profile"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold uppercase tracking-wide text-slate-900 shadow-lg hover:bg-white/95 active:scale-[0.99] transition-all"
            >
              Edit profile
            </Link>
          </div>
        ) : meLoading ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-white/70 text-sm">
            <Loader2 className="size-8 animate-spin opacity-80" />
            <span>Loading…</span>
          </div>
        ) : !me ? (
          <p className="mt-12 text-center text-sm text-white/70 max-w-sm">
            Open {PRODUCT.name} on this device to message {profile.username}.
          </p>
        ) : (
          <>
            {!canConnect ? (
              <p className="mt-6 max-w-md text-center text-sm text-amber-200/90">
                {profile.username} isn&apos;t accepting new messages right now.
              </p>
            ) : null}

            <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void onMessage()}
                disabled={connecting || (!existingChatId && !canConnect)}
                className={cn(
                  "flex min-h-[52px] items-center justify-center gap-2 rounded-2xl text-sm font-bold uppercase tracking-wide shadow-lg transition-all",
                  existingChatId || canConnect
                    ? "bg-white text-slate-900 hover:bg-white/95 active:scale-[0.98] disabled:opacity-50"
                    : "bg-white/20 text-white/50 cursor-not-allowed"
                )}
              >
                {connecting ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <MessageCircle className="size-5" />
                )}
                {connecting ? "…" : existingChatId ? "Open chat" : "Message"}
              </button>
              <button
                type="button"
                disabled={sharing}
                onClick={() => void onShareProfile()}
                className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/10 text-sm font-bold uppercase tracking-wide backdrop-blur-sm hover:bg-white/15 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {sharing ? <Loader2 className="size-5 animate-spin" /> : <Share2 className="size-5" />}
                Share
              </button>
            </div>

            <p className="mt-8 text-center text-[11px] text-white/45">
              Signed in as <span className="font-medium text-white/70">{me.username}</span>
            </p>
          </>
        )}
      </div>

      <p className="relative z-10 pb-4 text-center text-[10px] text-white/35">{PRODUCT.name}</p>
    </div>
  );
}
