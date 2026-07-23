"use client";

import * as React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { project } from "@/config/project";
import { ROLES, type Role } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

const ROLE_LABEL: Record<Role, string> = {
  dispatcher: "Dispatcher (119 call taker)",
  ambulance: "Ambulance crew",
  hospital: "Hospital staff",
};

type HospitalOption = { id: string; short_name: string };

/**
 * Self-service sign-up.
 *
 * The role picked here is a REQUEST, not a grant. The new profile is written
 * unverified (is_verified defaults false and the column isn't grantable), so it
 * carries no JWT role claim and lands on /pending until an admin flips the flag
 * in Supabase. Picking "dispatcher" here gets you nothing on its own.
 *
 * Hospital staff choose their hospital (the scope constraint requires it).
 * Ambulance crews just request the role — an admin assigns the actual vehicle
 * at verification.
 */
export default function RegisterPage() {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [organization, setOrganization] = React.useState("");
  const [role, setRole] = React.useState<Role>("dispatcher");
  const [hospitalId, setHospitalId] = React.useState("");

  const [hospitals, setHospitals] = React.useState<HospitalOption[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Public GET — the "/" directory reads it too, so no session needed.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/hospitals")
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.ok) setHospitals(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (role === "hospital" && !hospitalId) {
      setError("Hospital staff must choose their hospital.");
      return;
    }

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

    if (signUpError) {
      setBusy(false);
      setError(signUpError.message);
      return;
    }

    // "Confirm email" on → no session yet, so we can't write the profile as
    // this user. They finish it from /profile after confirming and signing in.
    if (!data.session) {
      setBusy(false);
      setEmailSent(true);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user!.id,
      full_name: fullName,
      role,
      phone,
      organization,
      hospital_id: role === "hospital" ? hospitalId : null,
    });
    setBusy(false);

    if (profileError) {
      setError(`Account created, but saving your details failed: ${profileError.message}`);
      return;
    }

    window.location.assign("/pending");
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>Create a {project.name} account</CardTitle>
            <CardDescription>
              Choose your role — an administrator verifies it before you get access.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {emailSent ? (
              <p className="text-sm text-muted">
                Check <strong>{email}</strong> for a confirmation link. After you
                confirm and sign in, open your profile to finish setting up your
                role.
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

                <Field label="Role" htmlFor="role">
                  <Select
                    id="role"
                    required
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </Select>
                </Field>

                {role === "hospital" ? (
                  <Field label="Your hospital" htmlFor="hospital">
                    <Select
                      id="hospital"
                      required
                      value={hospitalId}
                      onChange={(e) => setHospitalId(e.target.value)}
                    >
                      <option value="">Select a hospital…</option>
                      {hospitals.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.short_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                {role === "ambulance" ? (
                  <p className="text-xs text-muted">
                    An administrator assigns your vehicle when they verify your
                    account.
                  </p>
                ) : null}

                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>

                <Field label="Organization" htmlFor="organization" hint="EMS operator or hospital group.">
                  <Input
                    id="organization"
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
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
