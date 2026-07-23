import type { Metadata } from "next";
import { FleetPanel } from "@/components/mediroute/fleet-panel";
import { FleetDescription } from "@/components/mediroute/fleet-description";
import { TranslatedPageHeader } from "@/components/translated-page-header";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Fleet ops" };

export default function FleetPage() {
  return (
    <PageShell wide>
      <TranslatedPageHeader
        titleKey="fleet.pageTitle"
        eyebrowKey="fleet.eyebrow"
        description={<FleetDescription />}
      />
      <FleetPanel />
    </PageShell>
  );
}
