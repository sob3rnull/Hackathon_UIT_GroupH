import type { Metadata } from "next";
import { AmbulanceDashboard } from "@/components/mediroute/ambulance-dashboard";
import { PageHeader, PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Ambulance" };

export default function AmbulancePage() {
  return (
    <PageShell>
      <PageHeader
        title="Crew dashboard"
        description="Your current run, the patient, and where you're taking them. Update your status as the run progresses — dispatch sees it immediately."
      />
      <AmbulanceDashboard />
    </PageShell>
  );
}
