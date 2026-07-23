import { storeMode } from "@/lib/mediroute/store";
import { createClient } from "@/lib/supabase/server";
import { SiteHeaderClient } from "@/components/site-header-client";

/** Server wrapper: reads storeMode() and the session, both server-only, then hands off to the client chrome. */
export async function SiteHeader() {
  const mode = storeMode();

  const supabase = await createClient();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };

  return <SiteHeaderClient mode={mode} signedIn={Boolean(user)} />;
}
