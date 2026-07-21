import { ArrowRight } from "lucide-react";
import { project } from "@/config/project";
import { Workspace } from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardTitle, CardDescription } from "@/components/ui/card";

export default function HomePage() {
  return (
    <>
      {/* ── Hero: the first thing judges see. ─────────────────────────── */}
      <section className="hero-glow border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-5 px-5 py-16 sm:py-24">
          <Badge tone="accent">{project.team}</Badge>

          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {project.name}
          </h1>
          <p className="max-w-xl text-lg text-muted">{project.tagline}</p>
          <p className="max-w-2xl text-sm text-muted">{project.pitch}</p>

          <a
            href="#workspace"
            className="group inline-flex items-center gap-2 text-sm font-medium text-accent"
          >
            Try it
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>

      {/* ── Three value props. ────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-12">
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

      {/* ── The live demo. ────────────────────────────────────────────── */}
      <section id="workspace" className="mx-auto max-w-5xl scroll-mt-20 px-5 pb-20">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Workspace</h2>
          <p className="text-sm text-muted">
            A working slice you can point at the real problem.
          </p>
        </div>
        <Workspace />
      </section>
    </>
  );
}
