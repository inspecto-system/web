"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { errorKey } from "@/api/errors";
import { useSession } from "@/auth/session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Shortest password the API accepts (platform/api/core.yaml, Password). */
export const MIN_PASSWORD_LENGTH = 10;

/** Sign-in or registration (T-502); the server decides, the form only prevents obvious mistakes. */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations("auth");
  const errors = useTranslations("errors");
  const session = useSession();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (register && password.length < MIN_PASSWORD_LENGTH) {
      setError(t("passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (register) await session.register(fullName, email, password);
      else await session.login(email, password);
    } catch (failure) {
      setError(errors(errorKey(failure)));
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{register ? t("registerTitle") : t("loginTitle")}</CardTitle>
          <CardDescription>{t("tagline")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            {register && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  required
                  maxLength={200}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {register && (
                <p className="text-muted-foreground text-sm">
                  {t("passwordHint", { min: MIN_PASSWORD_LENGTH })}
                </p>
              )}
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={busy}>
              {register ? t("registerAction") : t("loginAction")}
            </Button>
            <p className="text-center text-sm">
              {register ? t("haveAccount") : t("noAccount")}{" "}
              <Link className="underline" href={register ? "/login" : "/register"}>
                {register ? t("loginLink") : t("registerLink")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
