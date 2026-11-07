import { RequireSession } from "@/auth/guards";
import { AppHeader } from "@/components/app-header";
import { NewInspection } from "@/inspections/new-inspection";

export default async function NewInspectionPage({ params }: PageProps<"/properties/[id]/inspections/new">) {
  const { id } = await params;
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">
        <NewInspection propertyId={id} />
      </main>
    </RequireSession>
  );
}
