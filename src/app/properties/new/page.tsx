import { RequireSession } from "@/auth/guards";
import { AppHeader } from "@/components/app-header";
import { NewProperty } from "@/properties/new-property";

export default function NewPropertyPage() {
  return (
    <RequireSession>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">
        <NewProperty />
      </main>
    </RequireSession>
  );
}
