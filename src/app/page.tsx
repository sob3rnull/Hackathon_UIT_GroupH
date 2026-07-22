import Link from "next/link";
import {
  Ambulance,
  ArrowRight,
  Building2,
  ClipboardList,
  Hospital,
  MapPin,
  Mic2,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { project } from "@/config/project";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page";

/**
 * Landing page. The console used to live here, which meant the first thing a
 * judge saw was a working screen with no explanation of what it does. Now the
 * page explains the run in four beats and hands off to the role screens.
 */

const flow = [
  {
    icon: PhoneCall,
    title: "Emergency received",
    category: project.category,
    body: "The 119 call taker dictates or types what the caller reports.",
  },
  {
    icon: Mic2,
    title: project.flowCategory.label,
    category: "Voice intake",
    body: project.flowCategory.body,
  },
  {
    icon: Sparkles,
    title: "AI triage analysis",
    category: "Clinical decision support",
    body: "Condition, severity and required specialty are extracted, with the findings that drove the call.",
  },
  {
    icon: Ambulance,
    title: "Ambulance selected",
    category: "Fleet routing",
    body: "The nearest certified vehicle reporting live GPS is assigned.",
  },
  {
    icon: Hospital,
    title: "Hospital selected",
    category: "Capacity matching",
    body: "Hospitals that cannot treat this patient are filtered out; the rest are ranked on live capacity and travel time.",
  },
];

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
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-5 py-14 sm:py-20">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{project.team}</Badge>
            <Badge>{project.category}</Badge>
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {project.name}
          </h1>
          <p className="max-w-2xl text-lg text-muted">{project.tagline}</p>
          <p className="max-w-3xl text-sm text-muted">{project.pitch}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/dispatcher"
              className="group inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover"
            >
              Open the dispatch console
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/history"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              See past incidents
            </Link>
          </div>
        </div>
      </section>

      <PageShell wide className="flex flex-col gap-12">
        {/* ── The run, in four beats ─────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              One call, five decisions
            </h2>
            <p className="text-sm text-muted">
              The dispatcher stays the decision maker at every step - every
              recommendation can be overridden in one click.
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {flow.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardBody className="flex h-full flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                        <step.icon className="size-4" />
                      </span>
                      <span className="font-mono text-xs text-muted">
                        Step {index + 1}
                      </span>
                    </div>
                    <Badge className="w-fit">{step.category}</Badge>
                    <CardTitle>{step.title}</CardTitle>
                    <CardDescription>{step.body}</CardDescription>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Role entry points ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">
              Pick your screen
            </h2>
            <p className="text-sm text-muted">
              Each role sees only what it needs. Sign-in is not implemented yet
              — for now the route is the role.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* ── What makes it different ────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Why this beats routing on distance
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {project.highlights.map((highlight) => (
              <Card key={highlight.title}>
                <CardBody className="flex flex-col gap-2">
                  <CardTitle>{highlight.title}</CardTitle>
                  <CardDescription>{highlight.body}</CardDescription>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </PageShell>
    </>
  );
}
