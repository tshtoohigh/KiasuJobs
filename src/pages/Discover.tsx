import { SwipeDeck } from "@/components/deck/SwipeDeck";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/stores/useAuth";

export function Discover() {
  const userId = useAuth((state) => state.session?.user?.id);
  const fullName = useAuth((state) => state.appUser?.full_name ?? "");

  if (!userId) return <Spinner />;

  const firstName = fullName.trim().split(/\s+/)[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-5 pb-3 pt-4">
        <h1 className="text-xl font-extrabold text-white">
          {firstName ? `Hey ${firstName}` : "Find your next role"}
        </h1>
        <p className="mt-0.5 text-xs text-muted-dark">
          Drag the card, or use the buttons · ← → also work
        </p>
      </header>

      <SwipeDeck seekerId={userId} />
    </div>
  );
}
