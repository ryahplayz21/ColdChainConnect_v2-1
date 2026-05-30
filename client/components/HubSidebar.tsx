import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Package,
  FileText,
  Truck,
  CreditCard,
  History,
} from "lucide-react";

interface Module {
  label: string;
  path: string;
}

interface HubSidebarProps {
  modules: Module[];
  basePath: string;
  agentMode?: boolean;
}

const moduleIcons: Record<string, React.ElementType> = {
  "/order-summary":    ClipboardList,
  "/inventory":        Package,
  "/invoicing":        FileText,
  "/delivery":         Truck,
  "/accounts":         CreditCard,
  "/delivery-history": History,
};

export function HubSidebar({ modules, basePath, agentMode = false }: HubSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  // ── Mobile bottom nav (both agent and admin) ────────────────────
  const BottomNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-navy border-t border-white/10 flex items-stretch justify-around md:hidden">
      {modules.map((module) => {
        const fullPath = `${basePath}${module.path}`;
        const isActive = currentPath === fullPath || currentPath.startsWith(fullPath + "/");
        const Icon = moduleIcons[module.path] ?? ClipboardList;

        return (
          <Link
            key={module.path}
            to={fullPath}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 py-3 px-1 text-[10px] font-semibold transition-all min-w-0",
              isActive
                ? "text-white bg-accent-2"
                : "text-white/55 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="truncate w-full text-center leading-tight">
              {module.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  // ── Agent: fixed bottom app bar with icons ──────────────────────
  if (agentMode) {
    return <BottomNav />;
  }

  // ── Admin: original left sidebar + mobile bottom nav ─────────────
  return (
    <>
      <aside className="hidden md:flex w-56 bg-navy flex-col py-6 px-3 gap-2 flex-shrink-0 h-full overflow-y-auto scrollbar-visible">
        <nav className="flex flex-col gap-2">
          {modules.map((module) => {
            const fullPath = `${basePath}${module.path}`;
            const isActive = currentPath === fullPath || currentPath.startsWith(fullPath + "/");
            return (
              <Link
                key={module.path}
                to={fullPath}
                className={cn(
                  "flex items-center px-4 py-3 rounded-full text-sm font-semibold transition-all",
                  isActive
                    ? "bg-accent-2 text-white shadow-lg"
                    : "text-white/70 bg-white/5 hover:bg-white/15 hover:text-white"
                )}
              >
                {module.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <BottomNav />
    </>
  );
}
