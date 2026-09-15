import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

/**
 * Phone-shaped shell with a bottom tab bar. Capped at `max-w-md` and centred so
 * the same build looks deliberate on a desktop browser as well as in the
 * Capacitor Android wrapper.
 */
export function AppShell({
  items,
  children,
}: {
  items: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-bg">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="flex shrink-0 items-stretch border-t border-border bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold transition",
                isActive ? "text-accent" : "text-muted-dark hover:text-muted",
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Standard scrollable page body. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col p-5">{children}</div>;
}
