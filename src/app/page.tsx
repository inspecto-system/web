import { RequireSession } from "@/auth/guards";
import { AppHeader } from "@/components/app-header";
import { PropertyList } from "@/properties/property-list";

export default function Home() {
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <PropertyList />
      </main>
    </RequireSession>
  );
}
