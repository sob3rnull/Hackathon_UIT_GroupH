"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES, type Role, isRole } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageShell } from "@/components/ui/page";

const ROLE_LABEL: Record<Role, string> = {
  dispatcher: "Dispatcher",
  ambulance: "Ambulance crew",
  hospital: "Hospital staff",
};

type Profile = {
  id: string;
  full_name: string;
  role: Role;
  phone: string;
  organization: string;
  is_verified: boolean;
  hospital_id: string | null;
  ambulance_id: string | null;
};

type HospitalOption = { id: string; short_name: string };
type VehicleOption = { id: string; callsign: string };

/**
 * View and edit your own profile. RLS lets you touch only your row, and the
 * column grants mean role / verification / scope are read-only here — those
 * are the admin's to set in Supabase. If you registered while email
 * confirmation was on, no profile row exists yet, so this page also creates it.
 */
export default function ProfilePage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [hospitals, setHospitals] = React.useState<HospitalOption[]>([]);
  const [vehicles, setVehicles] = React.useState<VehicleOption[]>([]);
  const [loading, setLoading] = React.useState(true);

  // editable / creatable fields
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [organization, setOrganization] = React.useState("");
  const [role, setRole] = React.useState<Role>("dispatcher");
  const [hospitalId, setHospitalId] = React.useState("");
  const [ambulanceId, setAmbulanceId] = React.useState("");

  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      setUserId(user.id);

      const [{ data: row }, hospRes, vehRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        fetch("/api/hospitals").then((r) => r.json()).catch(() => null),
        fetch("/api/ambulances").then((r) => r.json()).catch(() => null),
      ]);
      if (cancelled) return;

      if (hospRes?.ok) setHospitals(hospRes.data);
      if (vehRes?.ok) setVehicles(vehRes.data);

      if (row) {
        const p = row as Profile;
        setProfile(p);
        setFullName(p.full_name);
        setPhone(p.phone);
        setOrganization(p.organization);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const supabase = createClient();
    if (!supabase || !userId) return;

    setBusy(true);

    if (profile) {
      // Edit: only the columns the grant allows.
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, organization })
        .eq("id", userId);
      setBusy(false);
      if (updErr) setError(updErr.message);
      else {
        setSaved(true);
        setProfile({ ...profile, full_name: fullName, phone, organization });
      }
      return;
    }

    // Create (email-confirm path): first profile row for this user.
    if (role === "hospital" && !hospitalId) {
      setBusy(false);
      setError("Hospital staff must choose their hospital.");
      return;
    }
    if (role === "ambulance" && !ambulanceId) {
      setBusy(false);
      setError("Ambulance crew must choose their vehicle.");
      return;
    }
    const { data: created, error: insErr } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: fullName,
        role,
        phone,
        organization,
        hospital_id: role === "hospital" ? hospitalId : null,
        ambulance_id: role === "ambulance" ? ambulanceId : null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (insErr) setError(insErr.message);
    else {
      setProfile(created as Profile);
      setSaved(true);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md py-12">
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>
              {profile
                ? "Update your contact details. Role and vehicle/hospital are set by an administrator."
                : "Finish setting up your account."}
            </CardDescription>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : !userId ? (
              <p className="text-sm text-muted">You&apos;re not signed in.</p>
            ) : (
              <form onSubmit={onSave} className="flex flex-col gap-4">
                {profile ? (
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted/50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Role</span>
                      <span className="font-medium">
                        {isRole(profile.role) ? ROLE_LABEL[profile.role] : profile.role}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Status</span>
                      {profile.is_verified ? (
                        <Badge tone="success">Verified</Badge>
                      ) : (
                        <Badge tone="warning">Awaiting verification</Badge>
                      )}
                    </div>
                  </div>
                ) : null}

                <Field label="Full name" htmlFor="full-name">
                  <Input
                    id="full-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>

                {!profile ? (
                  <>
                    <Field label="Role" htmlFor="role">
                      <Select
                        id="role"
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
                      <Field label="Your vehicle" htmlFor="vehicle">
                        <Select
                          id="vehicle"
                          value={ambulanceId}
                          onChange={(e) => setAmbulanceId(e.target.value)}
                        >
                          <option value="">Select a vehicle…</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.callsign}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    ) : null}
                  </>
                ) : null}

                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>

                <Field label="Organization" htmlFor="organization">
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
                {saved ? <p className="text-sm text-accent">Saved.</p> : null}

                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : profile ? "Save changes" : "Finish setup"}
                </Button>
              </form>
            )}

            {userId ? (
              <form action="/auth/signout" method="post" className="mt-4">
                <button
                  type="submit"
                  className="w-full text-center text-xs text-muted underline hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
