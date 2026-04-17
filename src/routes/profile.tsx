import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Copy, Check, RefreshCw, Info, ChevronRight, Heart } from "lucide-react";
import { MobileFrame } from "@/components/MobileFrame";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/use-me";
import { pickRandomAvatar, updateMyProfile } from "@/lib/identity";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Nicer Chat" },
      { name: "description", content: "Edit your Nicer Chat profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { me, setMe } = useMe();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  if (!me) {
    return (
      <MobileFrame>
        <StatusBar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
      </MobileFrame>
    );
  }

  const startEdit = () => { setName(me.username); setEditing(true); };

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

  const reroll = async () => {
    const newAvatar = pickRandomAvatar(me.username + Date.now());
    try {
      const updated = await updateMyProfile(me.id, { avatar_url: newAvatar });
      setMe(updated);
      toast.success("New avatar!");
    } catch (e) {
      console.error(e);
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(me.id);
    setCopied(true);
    toast.success("Your ID is copied");
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <MobileFrame>
      <StatusBar />

      <div className="flex items-center gap-3 px-4 py-3">
        <Link to="/" className="size-10 rounded-full hover:bg-muted/60 flex items-center justify-center">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">Your profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex flex-col items-center pt-6">
          <button onClick={reroll} className="relative group">
            <Avatar src={me.avatar_url} name={me.username} size={120} ring />
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <RefreshCw className="size-6 text-white" />
            </div>
          </button>
          <p className="text-xs text-muted-foreground mt-2">Tap avatar to reroll</p>

          {editing ? (
            <div className="mt-5 w-full max-w-xs flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 h-11 px-4 rounded-2xl bg-card border border-border text-center font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                autoFocus
              />
              <button onClick={save} className="size-11 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center">
                <Check className="size-5" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2">
              <h2 className="text-2xl font-bold font-display">{me.username}</h2>
              <button onClick={startEdit} className="size-8 rounded-full hover:bg-muted flex items-center justify-center">
                <Pencil className="size-4 text-muted-foreground" />
              </button>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1">{me.status}</p>
        </div>

        <div className="mt-8 space-y-3">
          <div className="bg-card/60 border border-border/60 rounded-2xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Nicer Chat ID</div>
            <button onClick={copyId} className="mt-2 w-full flex items-center justify-between gap-2 text-left">
              <code className="text-xs text-foreground/80 truncate">{me.id}</code>
              {copied ? <Check className="size-4 text-online" /> : <Copy className="size-4 text-muted-foreground" />}
            </button>
            <p className="text-[11px] text-muted-foreground mt-2">
              No sign-up needed. This ID is what identifies you on this device.
            </p>
          </div>

          <Link
            to="/about"
            className="bg-card/60 border border-border/60 rounded-2xl p-4 flex items-center gap-3 hover:bg-card/80 transition-colors"
          >
            <div className="size-10 rounded-xl bg-gradient-primary/20 flex items-center justify-center">
              <Info className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">About Nicer Chat</div>
              <p className="text-xs text-muted-foreground truncate">Meet the developer behind the app</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>

          <div className="bg-card/60 border border-border/60 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Heart className="size-3.5 text-primary" />
              <span>Free &amp; open source · Built by Highness Chinedu</span>
            </div>
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
