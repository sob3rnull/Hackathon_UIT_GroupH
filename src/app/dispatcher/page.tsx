import type { Metadata } from "next";
import { Dispatcher } from "@/components/mediroute/dispatcher";
import { PageHeader, PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Dispatch console" };

export default function DispatcherPage() {
  return (
    <PageShell wide>
      <PageHeader
        title="Dispatch console"
        description="Take the call and send the nearest dispatchable ambulance. Triage and the hospital pick happen on the crew's own tablet once they're rolling."
      />
      <Dispatcher />
    </PageShell>
  );
}
