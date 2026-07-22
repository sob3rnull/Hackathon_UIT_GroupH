import Link from "next/link";
import {
  Ambulance,
  ArrowRight,
  Building2,
  ClipboardList,
  HeartHandshake,
  MapPin,
  PhoneCall,
} from "lucide-react";
import { project } from "@/config/project";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { HospitalDirectory } from "@/components/mediroute/hospital-directory";

/**
 * The public face of MediRoute: a directory of the hospitals in the network
 * with live status and a (demo) donation flow. The operational screens are
 * linked from the header and the "For responders" row below.
 */

const roleIcons: Record<string, typeof PhoneCall> = {
  "/dispatcher": PhoneCall,
  "/hospital": Building2,
  "/ambulance": Ambulance,
  "/history": ClipboardList,
};

export default function HomePage() {
  return (
    <>
      <section className="hero-glow border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-5 py-14 text-center sm:py-18">
          <Badge tone="accent">Yangon emergency care network</Badge>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Every minute matters. Help hospitals stay ready.
          </h1>
          <p className="max-w-2xl text-lg text-muted">{project.tagline}</p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#donate"
              className="group inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
            >
              <HeartHandshake className="size-4" />
              Support a hospital
            </a>
            <Link
              href="/dispatcher"
              className="group inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              Open the dispatch console
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <HospitalDirectory />

      {/* ── Role entry points ────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-5 py-12">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">For responders</h2>
          <p className="text-sm text-muted">
            Each role sees only what it needs. Sign-in is not implemented yet —
            for now the route is the role.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {project.nav.map((link) => {
            const Icon = roleIcons[link.href] ?? MapPin;
            return (
              <Link key={link.href} href={link.href} className="group">
                <Card className="h-full transition-colors group-hover:border-accent/50">
                  <CardBody className="flex h-full flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="grid size-8 place-items-center rounded-lg bg-surface-muted text-muted transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                        <Icon className="size-4" />
                      </span>
                      <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </div>
                    <CardTitle>{link.label}</CardTitle>
                    <p className="text-xs font-medium text-muted">{link.role}</p>
                    <CardDescription>{link.blurb}</CardDescription>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
