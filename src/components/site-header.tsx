import { isRole, type Role } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { SiteHeaderClient } from "@/components/site-header-client";

/** Server wrapper: reads the session (server-only), then hands off to the client chrome. */
export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  // The role travels in the session token (app_metadata). Null for signed-out
  // visitors and for signed-in-but-unverified users — both get no route nav.
  const rawRole = user?.app_metadata?.role;
  const role: Role | null = isRole(rawRole) ? rawRole : null;

  return <SiteHeaderClient signedIn={Boolean(user)} role={role} />;
}
