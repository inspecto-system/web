import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthForm } from "@/auth/auth-form";
import { GuestOnly } from "@/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: `${t("registerTitle")} · Inspecto` };
}

export default function RegisterPage() {
  return (
    <GuestOnly>
      <AuthForm mode="register" />
    </GuestOnly>
  );
}
