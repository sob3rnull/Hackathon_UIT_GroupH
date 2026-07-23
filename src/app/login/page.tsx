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

/**
 * Pre-verified demo accounts from supabase/apply_auth_demo.sql — one per role.
 * They all share a single password: set NEXT_PUBLIC_DEMO_PASSWORD in
 * .env.local, or edit DEMO_PASSWORD below to whatever you gave the three users
 * in Supabase (Authentication → Users). This is the one value that must match
 * for the buttons to sign in.
 */
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "password";

const DEMO_ACCOUNTS = [
  { email: "dispatcher@wheeyaw.demo", labelKey: "auth.demoDispatcher" },
  { email: "crew@wheeyaw.demo", labelKey: "auth.demoCrew" },
  { email: "hospital@wheeyaw.demo", labelKey: "auth.demoHospital" },
] as const;

export default function LoginPage() {
  const t = useT();
  const { locale } = useLocale();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function signIn(emailValue: string, passwordValue: string) {
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError(t("auth.notConfigured"));
      return;
    }

    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: emailValue,
      password: passwordValue,
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    await signIn(email, password);
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

            {/* One-click demo logins — pre-verified accounts, one per role. */}
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-center text-xs font-medium text-muted">
                {t("auth.demoAccounts")}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void signIn(account.email, DEMO_PASSWORD)}
                  >
                    {t(account.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
