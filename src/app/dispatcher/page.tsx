import type { Metadata } from "next";
import { Dispatcher } from "@/components/mediroute/dispatcher";
import { PageHeader, PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Dispatch console" };

export default function DispatcherPage() {
  return (
    <PageShell wide>
      <PageHeader
        title="Dispatch console"
        description="Take the call, confirm the triage, and send the right vehicle to the hospital that can actually treat this patient. The system recommends — you decide."
      />
      <Dispatcher />
    </PageShell>
  );
}
