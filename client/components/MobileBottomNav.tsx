import { Link, useLocation } from "react-router-dom";
import { Settings, BarChart3, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/information-management/pricing", label: "Info Management", icon: Settings },
  { path: "/booking-dispatch/order-summary", label: "Booking & Dispatch", icon: BarChart3 },
  { path: "/audit", label: "Audit Log", icon: Clock },
];

export function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-navy border-t border-white/10 flex items-stretch justify-around md:hidden">
      {navItems.map((item) => {
        const isActive = currentPath === item.path || currentPath.startsWith(item.path + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 py-3 px-1 text-[10px] font-semibold transition-all min-w-0",
              isActive
                ? "text-white bg-accent-2"
                : "text-white/55 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className="truncate w-full text-center leading-tight">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
