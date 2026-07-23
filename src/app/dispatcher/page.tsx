import type { Metadata } from "next";
import { Dispatcher } from "@/components/mediroute/dispatcher";
import { TranslatedPageHeader } from "@/components/translated-page-header";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Dispatch console" };

export default function DispatcherPage() {
  return (
    <PageShell wide>
      <TranslatedPageHeader
        titleKey="dispatcher.pageTitle"
        descriptionKey="dispatcher.pageDescription"
      />
      <Dispatcher />
    </PageShell>
  );
}
