import type { Metadata } from "next";
import { FleetPanel } from "@/components/mediroute/fleet-panel";
import { PageHeader, PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Fleet ops" };

export default function FleetPage() {
  return (
    <PageShell wide>
      <PageHeader
        eyebrow={
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Operational tooling
          </span>
        }
        title="Fleet ops — device simulator"
        description={
          <>
            Stands in for the on-board IoT units. In production each vehicle
            posts its own GPS fix and status to <code>/api/ambulances/[id]</code>{" "}
            on a timer — a vehicle without a fitted device is never certified,
            and therefore never dispatchable. Crews use the Ambulance screen,
            not this one.
          </>
        }
      />
      <FleetPanel />
    </PageShell>
  );
}
