import type { Metadata } from "next";
import { HistoryPanel } from "@/components/mediroute/history-panel";
import { TranslatedPageHeader } from "@/components/translated-page-header";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Incident history" };

export default function HistoryPage() {
  return (
    <PageShell wide>
      <TranslatedPageHeader
        titleKey="history.pageTitle"
        descriptionKey="history.pageDescription"
      />
      <HistoryPanel />
    </PageShell>
  );
}
