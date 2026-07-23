"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HOME, isRole, safeNext } from "@/lib/auth/roles";
import { project } from "@/config/project";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateAuthError } from "@/lib/i18n/translate-auth-error";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

export default function LoginPage() {
  const t = useT();
  const { locale } = useLocale();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError(t("auth.notConfigured"));
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
      setError(translateAuthError(signInError.message, t, locale));
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
            <CardTitle>{t("auth.signInTitle", { name: project.name })}</CardTitle>
            <CardDescription>{t("auth.signInSubtitle")}</CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field label={t("auth.emailLabel")} htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field label={t("auth.passwordLabel")} htmlFor="password">
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
                {busy ? t("auth.signingIn") : t("auth.signIn")}
              </Button>

              <div className="flex flex-col gap-1 text-center text-xs text-muted">
                <Link href="/reset-password" className="hover:text-foreground">
                  {t("auth.forgotPassword")}
                </Link>
                <Link href="/register" className="hover:text-foreground">
                  {t("auth.createAccount")}
                </Link>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
