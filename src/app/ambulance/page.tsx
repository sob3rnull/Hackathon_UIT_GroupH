import type { Metadata } from "next";
import { AmbulanceDashboard } from "@/components/mediroute/ambulance-dashboard";
import { TranslatedPageHeader } from "@/components/translated-page-header";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Ambulance" };

export default function AmbulancePage() {
  return (
    <PageShell>
      <TranslatedPageHeader
        titleKey="ambulancePage.pageTitle"
        descriptionKey="ambulancePage.pageDescription"
      />
      <AmbulanceDashboard />
    </PageShell>
  );
}
