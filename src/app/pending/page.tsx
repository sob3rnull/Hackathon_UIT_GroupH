import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page";

export const metadata: Metadata = { title: "Awaiting verification" };

/**
 * Where the middleware sends a signed-in user whose profile isn't verified (or
 * doesn't exist yet), so their JWT carries no role claim. Without this page
 * that case would 404.
 */
export default function PendingPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-sm py-12">
        <Card>
          <CardHeader>
            <CardTitle>Awaiting verification</CardTitle>
            <CardDescription>
              You&apos;re signed in, but an administrator hasn&apos;t verified
              your account yet.
            </CardDescription>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              Once your account is verified, sign out and back in — your role
              travels inside the session token, so it only refreshes on a new
              sign-in.
            </p>
            <Link href="/profile">
              <Button variant="secondary" className="w-full">
                View or complete your profile
              </Button>
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-center text-xs text-muted underline hover:text-foreground"
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
