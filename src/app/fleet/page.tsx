import type { Metadata } from "next";
import { FleetPanel } from "@/components/mediroute/fleet-panel";

export const metadata: Metadata = { title: "Ambulance fleet" };

export default function FleetPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Ambulance fleet</h1>
        <p className="max-w-3xl text-sm text-muted">
          Stands in for the on-board IoT units. In production each vehicle posts
          its own GPS fix and status to <code>/api/ambulances/[id]</code> on a
          timer — a vehicle without a fitted device is never certified, and
          therefore never dispatchable.
        </p>
      </div>
      <FleetPanel />
    </section>
  );
}
