import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { InformationManagement } from "./pages/InformationManagement";
import { BookingDispatch } from "./pages/BookingDispatch";
import { AuditLogPage } from "./pages/AuditLog";
import { Topbar } from "./components/Topbar";
import { MobileBottomNav } from "./components/MobileBottomNav";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Full layout: topbar + mobile bottom nav (admin) */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar userName={user?.username || "User"} onLogout={logout} />
      <div className="flex flex-1">
        <div className="flex-1 flex flex-col bg-off-white min-w-0 pb-20 md:pb-0">
          {children}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
};

/** Agent layout: topbar only, no bottom nav, no back-to-dashboard */
const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar userName={user?.username || "User"} onLogout={logout} agentMode />
      <div className="flex-1 flex flex-col bg-off-white min-w-0">
        {children}
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, user } = useAuth();
  const isAgent = user?.role === "agent";

  // ── Agent: only booking-dispatch is accessible ──────────────────
  if (isAuthenticated && isAgent) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/booking-dispatch/*"
          element={
            <AgentLayout>
              <BookingDispatch />
            </AgentLayout>
          }
        />
        {/* Everything else → booking-dispatch */}
        <Route path="*" element={<Navigate to="/booking-dispatch/order-summary" replace />} />
      </Routes>
    );
  }

  // ── Admin: full access ───────────────────────────────────────────
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isAuthenticated ? <AppLayout><Dashboard /></AppLayout> : <Login />} />
      <Route path="/information-management/*" element={isAuthenticated ? <AppLayout><InformationManagement /></AppLayout> : <Login />} />
      <Route path="/booking-dispatch/*" element={isAuthenticated ? <AppLayout><BookingDispatch /></AppLayout> : <Login />} />
      <Route path="/audit" element={isAuthenticated ? <AppLayout><AuditLogPage /></AppLayout> : <Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.hasChildNodes()) {
  createRoot(rootElement).render(<App />);
}
