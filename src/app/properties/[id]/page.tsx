import { RequireSession } from "@/auth/guards";
import { AppHeader } from "@/components/app-header";
import { PropertyCard } from "@/properties/property-card";

export default async function PropertyPage({ params }: PageProps<"/properties/[id]">) {
  const { id } = await params;
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <PropertyCard id={id} />
      </main>
    </RequireSession>
  );
}
