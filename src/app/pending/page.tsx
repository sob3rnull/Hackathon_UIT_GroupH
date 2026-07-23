import type { Metadata } from "next";
import { PendingCard } from "@/components/auth/pending-card";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Awaiting verification" };

/**
 * Where the middleware sends a signed-in user whose profile isn't verified (or
 * doesn't exist yet), so their JWT carries no role claim. Without this page
 * that case would 404.
 */
export default function PendingPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <PendingCard />
      </div>
    </PageShell>
  );
}
