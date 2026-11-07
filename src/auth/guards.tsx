"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "@/auth/session-provider";

function Loading() {
  const t = useTranslations("common");
  return (
    <p className="text-muted-foreground p-8 text-center" role="status">
      {t("loading")}
    </p>
  );
}

/**
 * Pages of a signed-in user. The server cannot check the session (the token is only in the
 * browser's memory), so the check is here; the API refuses every call without a token anyway.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "signedOut") router.replace("/login");
  }, [status, router]);
  return status === "signedIn" ? children : <Loading />;
}

/** Sign-in and registration: a signed-in user goes straight to the dashboard. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (status === "signedIn") router.replace("/");
  }, [status, router]);
  return status === "signedOut" ? children : <Loading />;
}
