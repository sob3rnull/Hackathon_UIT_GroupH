import type { Metadata } from "next";
import { HistoryPanel } from "@/components/mediroute/history-panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Incident history" };

export default function HistoryPage() {
  return (
    <PageShell wide>
      <PageHeader
        title="Incident history"
        description="Every dispatch that has been confirmed, with what the system recommended and what the dispatcher actually chose."
      />
      <HistoryPanel />
    </PageShell>
  );
}
