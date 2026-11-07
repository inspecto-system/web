"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSession } from "@/auth/session-provider";
import { Button } from "@/components/ui/button";

/** Top bar of the signed-in pages: the app name, the user and sign-out. */
export function AppHeader() {
  const t = useTranslations();
  const { user, logout } = useSession();
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {t("app.name")}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm" data-testid="current-user">
            {user?.fullName}
          </span>
          <Button variant="outline" size="sm" onClick={() => void logout()}>
            {t("auth.logout")}
          </Button>
        </div>
      </div>
    </header>
  );
}
