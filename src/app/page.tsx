import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold">{t("app.name")}</h1>
      <p className="text-lg text-neutral-600">{t("app.tagline")}</p>
      <p>{t("home.comingSoon")}</p>
    </main>
  );
}
