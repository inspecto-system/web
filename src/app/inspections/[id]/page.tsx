import { RequireSession } from "@/auth/guards";
import { AppHeader } from "@/components/app-header";
import { InspectionView } from "@/inspections/inspection-view";

export default async function InspectionPage({ params }: PageProps<"/inspections/[id]">) {
  const { id } = await params;
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <InspectionView id={id} />
      </main>
    </RequireSession>
  );
}
