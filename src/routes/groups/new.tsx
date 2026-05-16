import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronRight, Users } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { StatusBar } from "@/components/StatusBar";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/lib/use-me";
import { listAllOtherProfiles } from "@/lib/chats";
import { createGroup } from "@/lib/groups";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/new")({
  component: NewGroupPage,
});

type Step = "members" | "name" | "description";

function NewGroupPage() {
  const navigate = useNavigate();
  const { me } = useMe();
  const [step, setStep] = useState<Step>("members");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProfiles = async () => {
    if (!me || loaded) return;
    const list = await listAllOtherProfiles(me.id);
    setProfiles(list);
    setLoaded(true);
  };

  if (me && !loaded) void loadProfiles();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async () => {
    if (!me || !title.trim()) return;
    setSaving(true);
    try {
      const { chatId } = await createGroup({
        meId: me.id,
        memberIds: [...selected],
        title: title.trim(),
        description: description.trim(),
      });
      toast.success("Group created");
      navigate({ to: "/chat/$chatId", params: { chatId } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't create group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveLayout>
      <StatusBar />
      <div className="flex flex-col min-h-screen max-w-lg mx-auto w-full">
        <div className="flex items-center gap-2 px-4 pt-12 pb-4">
          <button
            type="button"
            onClick={() => (step === "members" ? navigate({ to: "/" }) : setStep(step === "description" ? "name" : "members"))}
            className="size-9 rounded-full hover:bg-muted/60 flex items-center justify-center"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-xl font-bold font-display flex items-center gap-2">
            <Users className="size-5 text-primary" />
            New group
          </h1>
        </div>

        {step === "members" && (
          <div className="flex-1 px-4 pb-8">
            <p className="text-sm text-muted-foreground mb-4">Select people to add to your group.</p>
            <ul className="space-y-1 max-h-[50vh] overflow-y-auto">
              {profiles.map((p) => {
                const on = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors",
                        on ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-card/40"
                      )}
                    >
                      <Avatar src={p.avatar_url} name={p.username} size={48} />
                      <span className="flex-1 text-left font-semibold">{p.username}</span>
                      <span
                        className={cn(
                          "size-6 rounded-full border-2 flex items-center justify-center",
                          on ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                        )}
                      >
                        {on && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setStep("name")}
              className="mt-6 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Next <ChevronRight className="size-5" />
            </button>
          </div>
        )}

        {step === "name" && (
          <div className="flex-1 px-4 pb-8">
            <label className="text-sm font-semibold text-primary">Group name</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={48}
              placeholder="e.g. Weekend crew"
              className="mt-2 w-full h-12 px-4 rounded-2xl bg-card/60 border border-border text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              disabled={!title.trim()}
              onClick={() => setStep("description")}
              className="mt-8 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Next <ChevronRight className="size-5" />
            </button>
          </div>
        )}

        {step === "description" && (
          <div className="flex-1 px-4 pb-8">
            <label className="text-sm font-semibold text-primary">Description</label>
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={4}
              placeholder="What's this group about?"
              className="mt-2 w-full px-4 py-3 rounded-2xl bg-card/60 border border-border resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void create()}
              className="mt-8 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold disabled:opacity-40"
            >
              {saving ? "Creating…" : "Create group"}
            </button>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
