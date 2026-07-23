"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/context";

/** The pending-verification notice, translated. Split out so `pending/page.tsx` can keep its `metadata` export. */
export function PendingCard() {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("auth.noRoleTitle")}</CardTitle>
        <CardDescription>{t("auth.noRoleSubtitle")}</CardDescription>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("auth.noRoleBody")}</p>
        <Link href="/profile">
          <Button variant="secondary" className="w-full">
            {t("auth.viewOrCompleteProfile")}
          </Button>
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full text-center text-xs text-muted underline hover:text-foreground"
          >
            {t("auth.signOut")}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
