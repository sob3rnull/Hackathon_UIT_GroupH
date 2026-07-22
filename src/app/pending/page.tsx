import type { Metadata } from "next";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Awaiting access" };

/**
 * Where the middleware sends a signed-in user who has no `profiles` row, and
 * therefore no role claim. Without this page that case would 404.
 */
export default function PendingPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>Your account has no role yet</CardTitle>
            <CardDescription>
              You&apos;re signed in, but nobody has assigned you to a dispatch
              centre, a vehicle, or a hospital.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              An administrator needs to add a profile row for you. Once they do,
              sign out and back in — your role travels inside the session token,
              so it only refreshes on a new sign-in.
            </p>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs text-muted underline hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
