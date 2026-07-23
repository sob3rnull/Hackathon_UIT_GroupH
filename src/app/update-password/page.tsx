"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateAuthError } from "@/lib/i18n/translate-auth-error";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

/**
 * Reached from the emailed reset link, after /auth/callback has exchanged the
 * code for a session. The user is signed in by the time they land here — which
 * is why the middleware deliberately does NOT bounce signed-in users off this
 * path the way it does /login.
 */
export default function UpdatePasswordPage() {
  const t = useT();
  const { locale } = useLocale();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError(t("auth.notConfiguredGeneric"));
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(translateAuthError(updateError.message, t, locale));
      return;
    }

    // Full navigation so middleware re-reads the session and routes by role.
    window.location.assign("/");
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.updateTitle")}</CardTitle>
            <CardDescription>{t("auth.updateSubtitle")}</CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field
                label={t("auth.newPassword")}
                htmlFor="password"
                hint={t("auth.newPasswordHint")}
              >
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

              <Field label={t("auth.confirmNewPassword")} htmlFor="confirm">
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>

              {error ? (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={busy}>
                {busy ? t("auth.saving") : t("auth.savePassword")}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
