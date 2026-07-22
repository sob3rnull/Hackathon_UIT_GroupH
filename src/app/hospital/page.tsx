import type { Metadata } from "next";
import { HospitalPanel } from "@/components/mediroute/hospital-panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Hospital dashboard" };

export default function HospitalPage() {
  return (
    <PageShell wide>
      <PageHeader
        title="Hospital dashboard"
        description="Keep beds, ICU and the ER queue current. Every change re-ranks the dispatcher's recommendation the moment you make it."
      />
      <HospitalPanel />
    </PageShell>
  );
}
