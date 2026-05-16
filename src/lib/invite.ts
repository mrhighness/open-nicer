import { supabase } from "@/integrations/supabase/client";
import type { InviteProfile } from "@/lib/share";

export async function getProfileForInvite(userId: string): Promise<InviteProfile | null> {
  const { data, error } = await supabase.rpc("get_profile_for_invite", { target_id: userId });
  if (error) {
    console.error("get_profile_for_invite:", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  const p = row as InviteProfile & { bio?: string | null };
  return { ...p, bio: p.bio ?? null };
}
