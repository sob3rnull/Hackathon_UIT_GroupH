"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HOME, isRole, safeNext } from "@/lib/auth/roles";
import { project } from "@/config/project";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase isn't configured, so there's nothing to sign in to.");
      return;
    }

    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);

    if (signInError) {
      // Supabase returns the same message for wrong password and unknown
      // address, which is what you want — don't help anyone enumerate users.
      setError(signInError.message);
      return;
    }

    // Resolve the destination here rather than bouncing off "/": that's the
    // public directory now, and the middleware deliberately lets it through,
    // so landing there would leave the user short of their dashboard.
    const role = data.user?.app_metadata?.role;
    const home = isRole(role) ? HOME[role] : "/pending";

    // Full navigation rather than router.push, so the middleware sees the
    // freshly-written session cookie on the very next request.
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    window.location.assign(next ?? home);
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>Sign in to {project.name}</CardTitle>
            <CardDescription>
              Your account decides which dashboard you land on.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>

              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>

              <div className="flex flex-col gap-1 text-center text-xs text-muted">
                <Link href="/reset-password" className="hover:text-foreground">
                  Forgot your password?
                </Link>
                <Link href="/register" className="hover:text-foreground">
                  Create an account
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
