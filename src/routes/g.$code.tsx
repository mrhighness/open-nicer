import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { AppLogo } from "@/components/AppLogo";
import { useMe } from "@/lib/use-me";
import { getGroupByInviteCode, joinGroupByInvite } from "@/lib/groups";
import { isOnboardingComplete } from "@/lib/onboarding";
import { toast } from "sonner";
import { EM_DASH, pageHead } from "@/lib/seo";
import { PRODUCT } from "@/lib/product";

export const Route = createFileRoute("/g/$code")({
  head: () =>
    pageHead({
      title: `Join group ${EM_DASH} ${PRODUCT.name}`,
      description: `Join a group chat on ${PRODUCT.name}.`,
      path: "/g",
      index: false,
    }),
  loader: async ({ params }) => {
    const group = await getGroupByInviteCode(params.code);
    return { group, code: params.code };
  },
  component: GroupJoinPage,
});

function GroupJoinPage() {
  const { group, code } = Route.useLoaderData();
  const { me, loading } = useMe();
  const navigate = useNavigate();

  const onJoin = async () => {
    if (!me) return;
    try {
      const chatId = await joinGroupByInvite(me.id, code);
      toast.success(`Joined ${group?.title ?? "group"}`);
      navigate({ to: "/chat/$chatId", params: { chatId } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't join group");
    }
  };

  if (!group) {
    return (
      <ResponsiveLayout>
        <div className="p-8 text-center mt-20">
          <h1 className="text-xl font-semibold">Group not found</h1>
          <Link to="/" className="inline-block mt-4 text-primary">
            Go home
          </Link>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center max-w-md mx-auto">
        <AppLogo size="lg" className="mb-6" />
        <Users className="size-10 text-primary mb-3" />
        <h1 className="text-2xl font-bold">{group.title}</h1>
        {group.description && <p className="text-muted-foreground mt-2 text-sm">{group.description}</p>}
        <p className="text-xs text-muted-foreground mt-4 font-mono">Code: {code}</p>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : me ? (
          <button
            type="button"
            onClick={() => void onJoin()}
            className="mt-8 w-full h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold"
          >
            Join group
          </button>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">Setting up your profile…</p>
        )}

        {!isOnboardingComplete() && me && (
          <p className="mt-4 text-xs text-muted-foreground">Complete welcome setup first, then return to this link.</p>
        )}
      </div>
    </ResponsiveLayout>
  );
}
