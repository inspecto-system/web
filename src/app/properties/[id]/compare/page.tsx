import { Comparison } from "@/analytics/comparison";
import { RequireSession } from "@/auth/guards";
import { AppHeader } from "@/components/app-header";

export default async function ComparePage({ params }: PageProps<"/properties/[id]/compare">) {
  const { id } = await params;
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Comparison propertyId={id} />
      </main>
    </RequireSession>
  );
}
