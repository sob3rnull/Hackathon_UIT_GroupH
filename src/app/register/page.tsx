"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { project } from "@/config/project";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

/**
 * Self-service sign-up.
 *
 * A new account carries NO role — roles live in public.profiles and only an
 * admin inserts them. So whoever registers here lands on /pending until someone
 * assigns them a dispatch centre, vehicle or hospital. That's deliberate: the
 * page hands out an identity, never access.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase isn't configured, so accounts can't be created.");
      return;
    }

    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setBusy(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // With "Confirm email" off, signUp returns a live session — go to /pending.
    // With it on, there's no session yet; tell them to check their inbox.
    if (data.session) {
      window.location.assign("/pending");
    } else {
      setEmailSent(true);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>Create a {project.name} account</CardTitle>
            <CardDescription>
              An administrator assigns your role after you register.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {emailSent ? (
              <p className="text-sm text-muted">
                Check <strong>{email}</strong> for a confirmation link. Once
                you&apos;ve confirmed, sign in — you&apos;ll wait on a holding
                screen until an administrator assigns your role.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <Field label="Full name" htmlFor="full-name">
                  <Input
                    id="full-name"
                    autoComplete="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>

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

                <Field label="Password" htmlFor="password" hint="At least 6 characters.">
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
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
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            )}

            <Link
              href="/login"
              className="mt-4 block text-center text-xs text-muted hover:text-foreground"
            >
              Already have an account? Sign in
            </Link>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
