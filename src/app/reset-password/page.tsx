"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

export default function ResetPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase isn't configured, so no email can be sent.");
      return;
    }

    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    setBusy(false);

    // Report success either way. Telling the caller "no such account" would
    // turn this form into a user-enumeration oracle.
    if (resetError) setError(resetError.message);
    else setSent(true);
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>Reset your password</CardTitle>
            <CardDescription>
              We&apos;ll email you a link to choose a new one.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {sent ? (
              <p className="text-sm text-muted">
                If an account exists for <strong>{email}</strong>, a reset link is
                on its way. The link expires shortly, so use it soon.
              </p>
            ) : (
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

                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            )}

            <Link
              href="/login"
              className="mt-4 block text-center text-xs text-muted hover:text-foreground"
            >
              Back to sign in
            </Link>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
