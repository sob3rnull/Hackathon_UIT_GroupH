import type { Metadata } from "next";
import { HospitalPanel } from "@/components/mediroute/hospital-panel";
import { TranslatedPageHeader } from "@/components/translated-page-header";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Hospital dashboard" };

export default function HospitalPage() {
  return (
    <PageShell wide>
      <TranslatedPageHeader
        titleKey="hospitalPanel.pageTitle"
        descriptionKey="hospitalPanel.pageDescription"
      />
      <HospitalPanel />
    </PageShell>
  );
}
