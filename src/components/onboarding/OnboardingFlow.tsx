import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Sparkles,
  Camera,
  Copy,
  Check,
  Share2,
  ChevronRight,
  Loader2,
  SkipForward,
  KeyRound,
  ImagePlus,
  Users,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { Avatar } from "@/components/Avatar";
import { CameraCapture } from "@/components/CameraCapture";
import { InviteSocialSheet, requestInviteShare } from "@/components/InviteSocialSheet";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { PRODUCT } from "@/lib/product";
import { updateMyProfile } from "@/lib/identity";
import { uploadAvatar } from "@/lib/uploads";
import { generateAiCharacterFromPhoto, getAiAvatarProvider, hasAiAvatarApiKey } from "@/lib/ai-avatar";
import { profileInviteUrl } from "@/lib/share";
import { copyProfileInvite } from "@/lib/share-invite";
import type { Profile } from "@/lib/use-me";
import { toast } from "sonner";

type Step = "welcome" | "avatar" | "invite" | "retain_offer" | "visibility" | "done";

type Props = {
  profile: Profile;
  onFinished: (profile: Profile, opts?: { openRetainAccount?: boolean; openRecoverAccount?: boolean }) => void;
  /** Welcome screen: go to dedicated sign-in page without finishing the rest of onboarding. */
  onOpenExistingAccountLogin?: () => void;
};

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -28 },
  transition: { type: "spring" as const, stiffness: 380, damping: 34 },
};

export type OnboardingInviteSocialHandle = { open: () => void };

/** Keeps invite-picker state local so the main flow cannot reference a missing `socialOpen` binding. */
const OnboardingInviteSocialHost = forwardRef<OnboardingInviteSocialHandle, { userId: string; username: string }>(
  function OnboardingInviteSocialHost({ userId, username }, ref) {
    const [open, setOpen] = useState(false);
    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
    return <InviteSocialSheet open={open} onClose={() => setOpen(false)} userId={userId} username={username} />;
  }
);

export function OnboardingFlow({ profile: initial, onFinished, onOpenExistingAccountLogin }: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [username, setUsername] = useState(initial.username);
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [aiAvatarFailed, setAiAvatarFailed] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadModeRef = useRef<"ai" | "own">("ai");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [discoverableDraft, setDiscoverableDraft] = useState(initial.discoverable);
  const [saving, setSaving] = useState(false);
  const finishProfileRef = useRef<Profile>(initial);
  const postRetainRef = useRef<"retain" | "done">("done");
  const abortRef = useRef<AbortController | null>(null);
  const inviteSocialRef = useRef<OnboardingInviteSocialHandle | null>(null);

  const inviteUrl = profileInviteUrl(initial.id);

  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewBlob);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, [previewBlob]);

  useEffect(() => {
    finishProfileRef.current = initial;
  }, [initial]);

  useEffect(() => {
    setDiscoverableDraft(initial.discoverable);
  }, [initial.discoverable, initial.id]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const displayAvatarSrc = avatarUrl ?? previewUrl ?? initial.avatar_url;

  const persistProfile = useCallback(async () => {
    let next = initial;
    if (username.trim() !== initial.username) {
      next = await updateMyProfile(initial.id, { username: username.trim() });
    }
    if (previewBlob) {
      const url = await uploadAvatar(next.id, previewBlob, "ai-character.png");
      next = await updateMyProfile(next.id, { avatar_url: url });
      setAvatarUrl(url);
    }
    return next;
  }, [initial, username, previewBlob]);

  const goNextFromWelcome = () => {
    if (!username.trim()) {
      toast.error("Pick a name to continue");
      return;
    }
    setEditingName(false);
    setStep("avatar");
  };

  const handlePhotoCapture = async (file: File) => {
    setCameraOpen(false);
    setAiAvatarFailed(false);
    setGenerating(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const { blob, source } = await generateAiCharacterFromPhoto(
        initial.id,
        file,
        abortRef.current.signal
      );
      setPreviewBlob(blob);
      if (source === "local") {
        toast.success("Preview look ready", {
          description: hasAiAvatarApiKey()
            ? "Add credits on DeepAI or Pixazo for a true 3D Bitmoji-style character."
            : "Add API keys and credits for full 3D character generation.",
          duration: 6000,
        });
      } else {
        toast.success("Your AI character is ready!");
      }
    } catch (e) {
      console.error(e);
      setAiAvatarFailed(true);
      const detail = e instanceof Error ? e.message : "Unknown error";
      toast.error("We couldn't create your look. Try another photo or use your photo as-is.", {
        description: detail.slice(0, 120),
        duration: 7000,
      });
    } finally {
      setGenerating(false);
    }
  };

  const onPickOwnPhoto = (file: File) => {
    setAiAvatarFailed(false);
    setPreviewBlob(file);
    toast.success("Photo selected — tap Next when ready");
  };

  const openPhotoPicker = (mode: "ai" | "own") => {
    uploadModeRef.current = mode;
    photoInputRef.current?.click();
  };

  const onPhotoFileSelected = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (uploadModeRef.current === "own") {
      onPickOwnPhoto(file);
      return;
    }
    void handlePhotoCapture(file);
  };

  const goNextFromAvatar = async () => {
    setSaving(true);
    try {
      await persistProfile();
      setStep("invite");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  };

  const skipAvatar = () => {
    setPreviewBlob(null);
    setStep("invite");
  };

  const onCopyInvite = async () => {
    try {
      await copyProfileInvite(initial.id, initial.username);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const onInvite = async () => {
    const result = await requestInviteShare(initial.id, username);
    if (result === "show-picker") inviteSocialRef.current?.open();
  };

  const proceedFromInvite = async () => {
    setSaving(true);
    try {
      const next = await persistProfile();
      if (next.avatar_url) setAvatarUrl(next.avatar_url);
      finishProfileRef.current = next;
      setStep("retain_offer");
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const goToDiscoverability = (next: "retain" | "done") => {
    postRetainRef.current = next;
    setDiscoverableDraft(finishProfileRef.current.discoverable);
    setStep("visibility");
  };

  const declineRetainSetup = () => {
    goToDiscoverability("done");
  };

  const acceptRetainSetup = () => {
    goToDiscoverability("retain");
  };

  const completeDiscoverability = async () => {
    setSaving(true);
    try {
      const p = finishProfileRef.current;
      const updated = await updateMyProfile(p.id, { discoverable: discoverableDraft });
      finishProfileRef.current = updated;
      if (postRetainRef.current === "retain") {
        onFinished(updated, { openRetainAccount: true });
      } else {
        setStep("done");
        setTimeout(() => onFinished(updated), 2800);
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save your choice");
    } finally {
      setSaving(false);
    }
  };

  const openRecoverFromOnboarding = () => {
    onFinished(finishProfileRef.current, { openRecoverAccount: true });
  };

  return (
    <motion.div
      className="fixed inset-0 z-[10000] flex min-h-0 flex-col overflow-hidden"
      style={{ backgroundImage: "var(--gradient-app)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="onboarding-orb onboarding-orb-a" aria-hidden />
      <div className="onboarding-orb onboarding-orb-b" aria-hidden />

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 safe-area-pad max-w-md mx-auto w-full flex flex-col items-center">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              className="w-full max-w-md flex flex-col items-center text-center pb-8"
              {...slide}
            >
              <AppLogo size="lg" className="mb-4 shadow-xl shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight leading-tight px-2">
                Welcome to{" "}
                <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">
                  {PRODUCT.name}
                </span>
              </h1>
              <p className="mt-3 text-muted-foreground text-sm sm:text-[15px] leading-relaxed max-w-sm px-1">
                No sign-up needed — we created your identity so you can start chatting right away.
              </p>

              <motion.div
                className="mt-5 w-full rounded-2xl border border-primary/20 bg-card/50 backdrop-blur-md p-4 shadow-md text-left"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08 }}
              >
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Your generated name</p>
                {editingName ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1 h-11 px-3 rounded-xl bg-background/80 border border-border text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/45"
                      maxLength={32}
                    />
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="size-11 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
                    >
                      <Check className="size-5" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xl font-bold tracking-tight truncate">{username}</span>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="size-10 shrink-0 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                      aria-label="Edit name"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                )}
              </motion.div>

              {onOpenExistingAccountLogin ? (
                <button
                  type="button"
                  onClick={() => onOpenExistingAccountLogin()}
                  className="mt-4 w-full rounded-2xl border border-primary/20 bg-card/40 py-3 px-3 text-xs sm:text-sm font-semibold text-primary hover:bg-card/55 transition-colors leading-snug"
                >
                  Already have an account? Sign in with ID & PIN
                </button>
              ) : null}

              <button
                type="button"
                onClick={goNextFromWelcome}
                className="mt-5 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground text-base font-semibold shadow-fab flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all"
              >
                Next
                <ChevronRight className="size-5" />
              </button>
            </motion.div>
          )}

          {step === "avatar" && (
            <motion.div key="avatar" className="w-full flex flex-col items-center text-center" {...slide}>
              <div className="relative mb-6">
                <Avatar
                  src={displayAvatarSrc}
                  name={username}
                  size={112}
                  ring
                  className={generating ? "opacity-60" : ""}
                />
                {generating && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-10 text-primary animate-spin" />
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold font-display">Create your look</h2>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed max-w-[300px]">
                We&apos;ll turn your photo into a 3D Bitmoji-style character that still looks like you. Take a selfie or upload from your device.
              </p>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPhotoFileSelected(f);
                  e.target.value = "";
                }}
              />

              {!hasAiAvatarApiKey() && (
                <p className="mt-3 text-[11px] text-amber-400/90 max-w-[300px] leading-relaxed">
                  Production: set <code className="text-xs">DEEPAI_API_KEY</code> on the host and{" "}
                  <code className="text-xs">VITE_SERVER_AI_DEEPAI=1</code> (keys never ship to the browser). Optional:{" "}
                  <code className="text-xs">PIXAZO_API_KEY</code> + <code className="text-xs">VITE_SERVER_AI_PIXAZO=1</code>
                  . Local dev may use <code className="text-xs">VITE_DEEPAI_API_KEY</code> /{" "}
                  <code className="text-xs">VITE_PIXAZO_API_KEY</code> with the dev proxy.{" "}
                  <a href="https://deepai.org" target="_blank" rel="noreferrer" className="underline">
                    deepai.org
                  </a>
                </p>
              )}
              {hasAiAvatarApiKey() && (
                <p className="mt-2 text-[10px] text-muted-foreground max-w-[300px] leading-snug">
                  AI look: your photo is sent to {getAiAvatarProvider() === "pixazo" ? "Pixazo" : "DeepAI"} only to
                  render an avatar (not posted publicly). You can use your photo without AI anytime.
                </p>
              )}
              {hasAiAvatarApiKey() && getAiAvatarProvider() === "pixazo" && (
                <p className="mt-1 text-[10px] text-muted-foreground max-w-[300px] leading-snug">
                  Using Pixazo as the image provider (DeepAI unavailable or not configured).
                </p>
              )}
              {aiAvatarFailed && (
                <div className="mt-4 w-full rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left text-sm">
                  <p>We couldn&apos;t generate an AI avatar. Continue with your system look, or use your photo as-is.</p>
                  <button
                    type="button"
                    onClick={() => openPhotoPicker("own")}
                    className="mt-3 w-full h-10 rounded-xl border border-border bg-card/60 flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <ImagePlus className="size-4" />
                    Use my photo instead
                  </button>
                </div>
              )}

              <div className="mt-8 w-full space-y-3">
                <button
                  type="button"
                  disabled={generating || saving}
                  onClick={() => setCameraOpen(true)}
                  className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold shadow-fab flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Camera className="size-5" />
                  Take a photo for AI character
                </button>
                <button
                  type="button"
                  disabled={generating || saving}
                  onClick={() => openPhotoPicker("ai")}
                  className="w-full h-12 rounded-2xl border border-primary/40 bg-card/50 font-semibold flex items-center justify-center gap-2 hover:bg-card/70 disabled:opacity-50"
                >
                  <ImagePlus className="size-5 text-primary" />
                  Upload from device
                </button>
                <button
                  type="button"
                  disabled={generating || saving}
                  onClick={() => openPhotoPicker("own")}
                  className="w-full h-11 rounded-2xl border border-border/60 bg-card/40 text-sm font-medium flex items-center justify-center gap-2 hover:bg-card/60 disabled:opacity-50"
                >
                  <ImagePlus className="size-4" />
                  Use my photo (no AI)
                </button>
                <button
                  type="button"
                  disabled={generating || saving}
                  onClick={skipAvatar}
                  className="w-full h-11 rounded-2xl border border-border/60 bg-card/40 text-sm font-medium flex items-center justify-center gap-2 hover:bg-card/60"
                >
                  <SkipForward className="size-4" />
                  Keep my generated look
                </button>
              </div>

              {(previewBlob || avatarUrl) && (
                <button
                  type="button"
                  disabled={generating || saving}
                  onClick={() => void goNextFromAvatar()}
                  className="mt-6 w-full h-12 rounded-2xl bg-card border border-primary/30 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5 text-primary" />}
                  {saving ? "Saving…" : "Next"}
                  {!saving && <ChevronRight className="size-5" />}
                </button>
              )}
            </motion.div>
          )}

          {step === "invite" && (
            <motion.div key="invite" className="w-full flex flex-col items-center text-center" {...slide}>
              <Avatar src={previewUrl ?? avatarUrl} name={username} size={72} ring className="mb-5" />
              <h2 className="text-2xl font-bold font-display">Invite your friends</h2>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
                Share your link so friends can message you on {PRODUCT.name}.
              </p>

              <div className="mt-6 w-full rounded-2xl border border-border/60 bg-card/40 p-3 flex items-center gap-2">
                <p className="flex-1 text-left text-xs text-muted-foreground truncate font-mono">{inviteUrl}</p>
                <button
                  type="button"
                  onClick={() => void onCopyInvite()}
                  className="shrink-0 size-9 rounded-xl bg-muted/60 flex items-center justify-center"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                </button>
              </div>

              <div className="mt-4 w-full flex gap-3">
                <button
                  type="button"
                  onClick={() => void onCopyInvite()}
                  className="flex-1 h-11 rounded-2xl border border-border/60 bg-card/40 text-sm font-semibold"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => void onInvite()}
                  className="flex-1 h-11 rounded-2xl bg-gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Share2 className="size-4" />
                  Invite
                </button>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void proceedFromInvite()}
                className="mt-8 w-full h-12 rounded-2xl bg-card border border-primary/30 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-5 animate-spin" /> : null}
                Done
                {!saving && <ChevronRight className="size-5" />}
              </button>
            </motion.div>
          )}

          {step === "retain_offer" && (
            <motion.div
              key="retain_offer"
              className="w-full max-w-md flex flex-col items-center text-center pb-8"
              {...slide}
            >
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
                <KeyRound className="size-8 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display leading-tight px-2">Save this account?</h2>
              <p className="mt-3 text-muted-foreground text-sm sm:text-[15px] leading-relaxed max-w-sm px-1">
                If you might use another browser or lose this device, you can keep a{" "}
                <span className="text-foreground/90 font-medium">5-digit Account ID</span> and a{" "}
                <span className="text-foreground/90 font-medium">4-digit Nicer PIN</span> to sign back in. This is
                optional.
              </p>
              <div className="mt-6 w-full max-w-sm mx-auto space-y-3">
                <button
                  type="button"
                  onClick={() => acceptRetainSetup()}
                  className="w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground text-base font-semibold shadow-fab"
                >
                  Yes — set up recovery
                </button>
                <button
                  type="button"
                  onClick={() => declineRetainSetup()}
                  className="w-full h-12 rounded-2xl border border-border/70 bg-card/50 text-base font-semibold text-foreground/90"
                >
                  Not now
                </button>
              </div>
              <button
                type="button"
                onClick={() => openRecoverFromOnboarding()}
                className="mt-5 text-xs sm:text-sm font-medium text-primary hover:underline px-3 leading-snug"
              >
                I already have an account — sign in with ID & PIN
              </button>
            </motion.div>
          )}

          {step === "visibility" && (
            <motion.div
              key="visibility"
              className="w-full max-w-md flex flex-col items-center text-center pb-8"
              {...slide}
            >
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
                <Users className="size-8 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display leading-tight px-2">How do you want to be seen?</h2>
              <p className="mt-3 text-muted-foreground text-sm sm:text-[15px] leading-relaxed max-w-sm px-1">
                Turn discoverability on if you&apos;re happy to show up when others search or browse{" "}
                <span className="text-foreground/90 font-medium">New chat</span>. Turn it off to stay quieter — you can
                still message anyone.
              </p>
              <div className="mt-5 w-full">
                <PrivacyToggle
                  label="Discoverable"
                  description="When off, you won't appear in search or the new-chat list. You can still message anyone."
                  checked={discoverableDraft}
                  onChange={setDiscoverableDraft}
                  disabled={saving}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void completeDiscoverability()}
                className="mt-6 w-full max-w-sm h-12 rounded-2xl bg-gradient-primary text-primary-foreground text-base font-semibold shadow-fab flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-5 animate-spin" /> : null}
                Continue
                {!saving && <ChevronRight className="size-5" />}
              </button>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative mb-2"
              >
                <Avatar src={displayAvatarSrc} name={username} size={104} ring />
                <motion.div className="absolute -bottom-1 -right-1 size-9 rounded-full bg-primary flex items-center justify-center ring-4 ring-background">
                  <Check className="size-5 text-primary-foreground" />
                </motion.div>
              </motion.div>
              <h2 className="mt-6 text-2xl font-bold font-display">
                Welcome to{" "}
                <span className="bg-gradient-to-r from-primary-glow to-primary bg-clip-text text-transparent">
                  Open Nicer
                </span>
              </h2>
              <p className="mt-3 text-muted-foreground text-sm italic max-w-[260px]">
                A space in the air for everyone.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => {
          if (file.type.startsWith("image/")) void handlePhotoCapture(file);
        }}
        onUpload={(file) => onPhotoFileSelected(file)}
        photoOnly
        defaultFacing="user"
      />

      <OnboardingInviteSocialHost ref={inviteSocialRef} userId={initial.id} username={username} />
    </motion.div>
  );
}

function OnboardingCheckmark() {
  return (
    <div className="relative size-28">
      <motion.svg
        viewBox="0 0 100 100"
        className="size-28"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <motion.circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="url(#onboardGrad)"
          strokeWidth="3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="onboardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary-glow))" />
            <stop offset="100%" stopColor="hsl(var(--primary))" />
          </linearGradient>
        </defs>
        <motion.path
          d="M30 52 L44 66 L72 38"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.35, duration: 0.45, ease: "easeOut" }}
        />
      </motion.svg>
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20 blur-2xl -z-10"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1.2, opacity: 0.6 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      />
    </div>
  );
}
