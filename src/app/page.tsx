import { ArrowRight } from "lucide-react";
import { project } from "@/config/project";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { Dispatcher } from "@/components/mediroute/dispatcher";

export default function HomePage() {
  return (
    <>
      <section className="hero-glow border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 py-14 sm:py-20">
          <Badge tone="accent">{project.team}</Badge>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {project.name}
          </h1>
          <p className="max-w-2xl text-lg text-muted">{project.tagline}</p>
          <p className="max-w-3xl text-sm text-muted">{project.pitch}</p>

          <a
            href="#dispatch"
            className="group inline-flex items-center gap-2 text-sm font-medium text-accent"
          >
            Open the dispatch console
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10">
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

      <section id="dispatch" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-20">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">Dispatch console</h2>
          <p className="text-sm text-muted">
            The system recommends. A human always decides.
          </p>
        </div>
        <Dispatcher />
      </section>
    </>
  );
}
