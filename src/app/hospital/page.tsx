import type { Metadata } from "next";
import { HospitalPanel } from "@/components/mediroute/hospital-panel";

export const metadata: Metadata = { title: "Hospital capacity" };

export default function HospitalPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-5 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hospital capacity</h1>
        <p className="text-sm text-muted">
          Stands in for a hospital information system feed. In production this
          would be an HIS integration, not a manual panel.
        </p>
      </div>
      <HospitalPanel />
    </section>
  );
}
